"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Pencil, Trash2, Send, MessageSquare, Smartphone, MonitorSmartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TemplateDialog } from "@/components/TemplateDialog";
import { TestSendDialog } from "@/components/TestSendDialog";
import { writeAudit } from "@/lib/audit";
import { fmtRelative } from "@/lib/format";
import { toast } from "sonner";

interface TemplateRow {
  id: string;
  template_name: string | null;
  template_category: string | null;
  template_variables: string[] | null;
  channel: string;
  subject: string | null;
  body: string | null;
  status: string | null;
  last_edited_at: string | null;
  last_edited_by: string | null;
}

interface ActorRow {
  id: string;
  full_name: string;
}

const CHANNEL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  sms: { label: "SMS", icon: Smartphone },
  portal_chat: { label: "Portal", icon: MonitorSmartphone },
};

type FilterChannel = "all" | "email" | "whatsapp" | "sms" | "portal_chat";

export default function AdminTemplates() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterChannel>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TemplateRow | null>(null);
  const [testing, setTesting] = useState<TemplateRow | null>(null);

  const templatesQ = useQuery({
    queryKey: ["admin-templates"],
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, template_name, template_category, template_variables, channel, subject, body, status, last_edited_at, last_edited_by",
        )
        .eq("is_template", true)
        .order("template_name");
      if (error) throw error;
      return (data ?? []) as TemplateRow[];
    },
  });

  const actorIds = useMemo(
    () =>
      Array.from(
        new Set(
          (templatesQ.data ?? [])
            .map((t) => t.last_edited_by)
            .filter((v): v is string => !!v),
        ),
      ),
    [templatesQ.data],
  );

  const actorsQ = useQuery({
    queryKey: ["admin-templates-actors", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("id, full_name")
        .in("id", actorIds);
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as ActorRow[]).map((s) => [s.id, s.full_name]));
    },
  });

  const counts = useMemo(() => {
    const all = templatesQ.data ?? [];
    return {
      all: all.length,
      email: all.filter((t) => t.channel === "email").length,
      whatsapp: all.filter((t) => t.channel === "whatsapp").length,
      sms: all.filter((t) => t.channel === "sms").length,
      portal_chat: all.filter((t) => t.channel === "portal_chat").length,
    };
  }, [templatesQ.data]);

  const filtered = useMemo(() => {
    let rows = templatesQ.data ?? [];
    if (filter !== "all") rows = rows.filter((t) => t.channel === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((t) => {
        const hay = [t.template_name, t.template_category, t.subject, t.body]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [templatesQ.data, filter, search]);

  const handleDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    void writeAudit({
      action: "DELETE",
      entity_type: "message_template",
      entity_id: id,
      changes: { template_name: deleting.template_name, channel: deleting.channel },
    });
    setDeleting(null);
    toast.success("Template deleted");
    void qc.invalidateQueries({ queryKey: ["admin-templates"] });
  };

  return (
    <>
      <AdminPageHeader
        title="Email & WhatsApp Templates"
        subtitle="Reusable message templates with merge variables. Used everywhere the CRM sends a message."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterChannel)}>
            <TabsList>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp ({counts.whatsapp})</TabsTrigger>
              <TabsTrigger value="email">Email ({counts.email})</TabsTrigger>
              <TabsTrigger value="sms">SMS ({counts.sms})</TabsTrigger>
              <TabsTrigger value="portal_chat">Portal ({counts.portal_chat})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full sm:max-w-xs"
          />
        </div>

        <div className="card-surface overflow-hidden">
          {templatesQ.isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-5 w-5" />}
              title={search.trim() ? "No matching templates" : "No templates yet"}
              description={
                search.trim()
                  ? "Try a different search."
                  : "Create your first template — variables like {{client.full_name}} get auto-filled when the message is sent."
              }
              action={
                !search.trim() ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> New template
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Channel</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Variables</th>
                  <th className="px-4 py-2.5 text-left">Last Edited</th>
                  <th className="px-4 py-2.5 text-right w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => {
                  const meta = CHANNEL_META[t.channel] ?? {
                    label: t.channel,
                    icon: Mail,
                  };
                  const Icon = meta.icon;
                  const editor = t.last_edited_by ? actorsQ.data?.[t.last_edited_by] : null;
                  return (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="font-medium text-navy">
                          {t.template_name ?? "—"}
                        </div>
                        {t.subject && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-md">
                            {t.subject}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {t.template_category?.replace(/_/g, " ") ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {(t.template_variables ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(t.template_variables ?? []).slice(0, 3).map((v) => (
                              <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                                {v}
                              </Badge>
                            ))}
                            {(t.template_variables ?? []).length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{(t.template_variables ?? []).length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">none</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {t.last_edited_at ? (
                          <>
                            {fmtRelative(t.last_edited_at)}
                            {editor && (
                              <div className="text-[10px] opacity-70">by {editor}</div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          {t.channel === "email" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setTesting(t)}
                              title="Test send"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(t)}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleting(t)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <TemplateDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        template={editing}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          void qc.invalidateQueries({ queryKey: ["admin-templates"] });
        }}
      />

      <TestSendDialog
        open={!!testing}
        onOpenChange={(o) => !o && setTesting(null)}
        templateId={testing?.id ?? null}
        templateName={testing?.template_name ?? null}
        channel={testing?.channel ?? null}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={
          deleting
            ? `"${deleting.template_name ?? "Untitled"}" will be removed permanently. Already-sent messages are unaffected.`
            : ""
        }
        confirmLabel="Delete template"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
