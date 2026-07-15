"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Mail,
  Smartphone,
  Globe,
  Phone,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { TemplateDialog } from "@/components/TemplateDialog";
import { TestSendDialog } from "@/components/TestSendDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { writeAudit } from "@/lib/audit";
import { fmtDateTimeIST, fmtRelative } from "@/lib/format";
import { toast } from "sonner";

type TemplateRow = {
  id: string;
  template_name: string | null;
  template_category: string | null;
  template_variables: string[] | null;
  channel: string;
  subject: string | null;
  body: string | null;
  created_at: string | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
};

type SentRow = {
  id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string | null;
  to_contact: string | null;
  from_contact: string | null;
  sent_at: string | null;
  created_at: string | null;
  is_read: boolean | null;
  client_id: string | null;
  case_id: string | null;
  lead_id: string | null;
  status: string | null;
  template_id: string | null;
  from_staff_id: string | null;
};

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  whatsapp: Smartphone,
  sms: Smartphone,
  portal_chat: Globe,
  call: Phone,
};

function ChannelChip({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICON[channel] ?? MessageSquare;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{channel.replace(/_/g, " ")}</span>
    </span>
  );
}

export default function Messages() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"templates" | "sent">("templates");

  // Templates state
  const [tplSearch, setTplSearch] = useState("");
  const [tplCategory, setTplCategory] = useState<string>("all");
  const [tplChannel, setTplChannel] = useState<string>("all");
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TemplateRow | null>(null);
  const [testSend, setTestSend] = useState<TemplateRow | null>(null);

  // Sent log state
  const [sentSearch, setSentSearch] = useState("");
  const [sentChannel, setSentChannel] = useState<string>("all");
  const [sentDirection, setSentDirection] = useState<string>("all");

  // Sent log: date range
  const [sentFrom, setSentFrom] = useState<string>("");
  const [sentTo, setSentTo] = useState<string>("");

  const templatesQ = useQuery({
    queryKey: ["message_templates"],
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, template_name, template_category, template_variables, channel, subject, body, created_at, last_edited_at, last_edited_by",
        )
        .eq("is_template", true)
        .order("template_category", { ascending: true })
        .order("template_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const sentQ = useQuery({
    queryKey: ["messages_sent"],
    queryFn: async (): Promise<SentRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, channel, direction, subject, body, to_contact, from_contact, sent_at, created_at, is_read, client_id, case_id, lead_id, status, template_id, from_staff_id",
        )
        .eq("is_template", false)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SentRow[];
    },
  });

  // Pull staff names + template names for joins
  const staffQ = useQuery({
    queryKey: ["staff_directory_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

  const staffNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (staffQ.data ?? []).forEach((s) => m.set(s.id, s.full_name));
    return m;
  }, [staffQ.data]);

  const templateNameMap = useMemo(() => {
    const m = new Map<string, string>();
    (templatesQ.data ?? []).forEach((t) => m.set(t.id, t.template_name ?? "Untitled"));
    return m;
  }, [templatesQ.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (templatesQ.data ?? []).forEach((t) => {
      if (t.template_category) set.add(t.template_category);
    });
    return Array.from(set).sort();
  }, [templatesQ.data]);

  const filteredTemplates = useMemo(() => {
    const list = templatesQ.data ?? [];
    const q = tplSearch.trim().toLowerCase();
    return list.filter((t) => {
      if (tplCategory !== "all" && t.template_category !== tplCategory) return false;
      if (tplChannel !== "all" && t.channel !== tplChannel) return false;
      if (q) {
        const hay = `${t.template_name ?? ""} ${t.subject ?? ""} ${t.body ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templatesQ.data, tplSearch, tplCategory, tplChannel]);

  const filteredSent = useMemo(() => {
    const list = sentQ.data ?? [];
    const q = sentSearch.trim().toLowerCase();
    const fromMs = sentFrom ? new Date(sentFrom + "T00:00:00").getTime() : null;
    const toMs = sentTo ? new Date(sentTo + "T23:59:59.999").getTime() : null;
    return list.filter((m) => {
      if (sentChannel !== "all" && m.channel !== sentChannel) return false;
      if (sentDirection !== "all" && m.direction !== sentDirection) return false;
      if (fromMs || toMs) {
        const ts = new Date(m.sent_at ?? m.created_at ?? 0).getTime();
        if (fromMs && ts < fromMs) return false;
        if (toMs && ts > toMs) return false;
      }
      if (q) {
        const hay = `${m.subject ?? ""} ${m.body ?? ""} ${m.to_contact ?? ""} ${m.from_contact ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sentQ.data, sentSearch, sentChannel, sentDirection, sentFrom, sentTo]);

  const handleDuplicate = async (t: TemplateRow) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        is_template: true,
        template_name: `${t.template_name ?? "Untitled"} (copy)`,
        template_category: t.template_category,
        template_variables: t.template_variables ?? [],
        channel: t.channel,
        direction: "outbound",
        subject: t.subject,
        body: t.body,
        from_staff_id: userRes.user?.id ?? null,
      } as never)
      .select("id")
      .maybeSingle();
    if (error) {
      toast.error("Failed to duplicate", { description: error.message });
      return;
    }
    if (data?.id) {
      void writeAudit({ action: "CREATE", entity_type: "message_template", entity_id: data.id, changes: { source: "duplicate", from: t.id } });
    }
    toast.success("Template duplicated");
    void qc.invalidateQueries({ queryKey: ["message_templates"] });
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    void writeAudit({ action: "DELETE", entity_type: "message_template", entity_id: id });
    toast.success("Template deleted");
    setConfirmDelete(null);
    void qc.invalidateQueries({ queryKey: ["message_templates"] });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reusable email & WhatsApp templates, plus a log of every outbound and inbound message.
          </p>
        </div>
        {tab === "templates" && (
          <Button onClick={() => setCreatingOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "templates" | "sent")}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="sent">Sent log</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates…"
                value={tplSearch}
                onChange={(e) => setTplSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tplCategory} onValueChange={setTplCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tplChannel} onValueChange={setTplChannel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="portal_chat">Portal chat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid */}
          {templatesQ.isLoading ? (
            <div className="card-surface">
              <TableSkeleton rows={6} cols={3} />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="card-surface">
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title={templatesQ.data?.length ? "No templates match your filters" : "No templates yet"}
                description={
                  templatesQ.data?.length
                    ? "Try clearing the search or category filter."
                    : "Create your first template to standardise your follow-ups across channels."
                }
                action={
                  !templatesQ.data?.length && (
                    <Button onClick={() => setCreatingOpen(true)}>
                      <Plus className="h-4 w-4" /> New template
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((t) => (
                <div key={t.id} className="card-surface p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-navy truncate">
                        {t.template_name || "Untitled"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <ChannelChip channel={t.channel} />
                        {t.template_category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.template_category.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {t.subject && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Subject:</span> {t.subject}
                    </div>
                  )}
                  <div
                    className="prose prose-sm max-w-none text-sm text-foreground/80 line-clamp-4"
                    dangerouslySetInnerHTML={{ __html: t.body || "<span class='italic text-muted-foreground'>(empty)</span>" }}
                  />
                  {(t.template_variables ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.template_variables!.map((v) => (
                        <code
                          key={v}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/70 font-mono"
                        >{`{{${v}}}`}</code>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                    <span className="text-[11px] text-muted-foreground">
                      {t.last_edited_at ? `Edited ${fmtRelative(t.last_edited_at)}` : fmtRelative(t.created_at)}
                      {t.last_edited_by && staffNameMap.get(t.last_edited_by) && (
                        <> · by {staffNameMap.get(t.last_edited_by)}</>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setTestSend(t)} title="Test send">
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDuplicate(t)} title="Duplicate">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(t)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search subject, body, contact…"
                value={sentSearch}
                onChange={(e) => setSentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sentChannel} onValueChange={setSentChannel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="portal_chat">Portal chat</SelectItem>
                <SelectItem value="call">Call</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sentDirection} onValueChange={setSentDirection}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={sentFrom}
                onChange={(e) => setSentFrom(e.target.value)}
                className="w-[150px]"
                aria-label="From date"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                type="date"
                value={sentTo}
                onChange={(e) => setSentTo(e.target.value)}
                className="w-[150px]"
                aria-label="To date"
              />
            </div>
            {(sentFrom || sentTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setSentFrom(""); setSentTo(""); }}>
                Clear dates
              </Button>
            )}
          </div>

          {sentQ.isLoading ? (
            <div className="card-surface">
              <TableSkeleton rows={8} cols={5} />
            </div>
          ) : filteredSent.length === 0 ? (
            <div className="card-surface">
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title={sentQ.data?.length ? "No messages match your filters" : "No messages yet"}
                description={
                  sentQ.data?.length
                    ? "Try clearing the filters."
                    : "Outbound emails, WhatsApp messages and call notes will appear here."
                }
              />
            </div>
          ) : (
            <div className="card-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">When</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium">Channel</th>
                      <th className="text-left px-4 py-2.5 font-medium">Subject / preview</th>
                      <th className="text-left px-4 py-2.5 font-medium">Template</th>
                      <th className="text-left px-4 py-2.5 font-medium">Sent by</th>
                      <th className="text-left px-4 py-2.5 font-medium">Recipient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSent.map((m) => {
                      const status = m.status ?? (m.direction === "inbound" ? "received" : "sent");
                      const statusCls =
                        status === "delivered" || status === "sent"
                          ? "bg-success/10 text-success"
                          : status === "failed" || status === "bounced"
                          ? "bg-destructive/10 text-destructive"
                          : status === "queued"
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-muted text-muted-foreground";
                      const tplName = m.template_id ? templateNameMap.get(m.template_id) : null;
                      const sentBy = m.from_staff_id ? staffNameMap.get(m.from_staff_id) : null;
                      return (
                        <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {fmtDateTimeIST(m.sent_at ?? m.created_at)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${statusCls}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <ChannelChip channel={m.channel} />
                          </td>
                          <td className="px-4 py-2.5 max-w-[360px]">
                            {m.subject && <div className="font-medium truncate">{m.subject}</div>}
                            <div className="text-muted-foreground text-xs line-clamp-2">{m.body}</div>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {tplName ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-foreground/80">{tplName}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {sentBy ?? (m.direction === "inbound" ? "—" : "system")}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                            {m.direction === "outbound" ? m.to_contact : m.from_contact}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TemplateDialog
        open={creatingOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreatingOpen(false);
            setEditing(null);
          }
        }}
        template={editing}
        onSaved={() => {
          setCreatingOpen(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["message_templates"] });
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Delete template?"
        description={`"${confirmDelete?.template_name ?? "Untitled"}" will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirmed}
      />

      <TestSendDialog
        open={!!testSend}
        onOpenChange={(v) => !v && setTestSend(null)}
        templateId={testSend?.id ?? null}
        templateName={testSend?.template_name ?? null}
        channel={testSend?.channel ?? null}
      />
    </div>
  );
}
