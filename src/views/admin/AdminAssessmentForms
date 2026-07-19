"use client";

// src/views/admin/AdminAssessmentForms.tsx — NEW 2026-07-18
// Control-center builder for assessment forms. Gaurav can create forms, edit
// sections/questions any time, set the default (what /assessment shows),
// and toggle active. Data: assessment_forms (sql/27).

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Plus, Trash2, ChevronUp, ChevronDown, Star, Copy, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const QUESTION_TYPES = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown (options)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

interface Question {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  show_if?: { key: string; equals: string } | null;
}
interface Section { title: string; questions: Question[] }
interface FormRow {
  id: string; code: string; title: string; description: string | null;
  is_active: boolean; is_default: boolean; sections: Section[];
}

export default function AdminAssessmentForms() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: forms = [], isLoading, error } = useQuery({
    queryKey: ["admin-assessment-forms"],
    queryFn: async () => {
      const { data, error } = await db.from("assessment_forms")
        .select("id, code, title, description, is_active, is_default, sections")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as FormRow[];
    },
    retry: false,
  });

  const select = (f: FormRow) => {
    setSelectedId(f.id);
    setDraft(JSON.parse(JSON.stringify(f)) as FormRow);
  };

  const newForm = async () => {
    const code = `FORM_${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await db.from("assessment_forms")
      .insert({ code, title: "New Assessment Form", description: "", is_active: false, is_default: false, sections: [{ title: "Section 1", questions: [] }] })
      .select().single();
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-assessment-forms"] });
    select(data as FormRow);
    toast.success("Form created — build your questions, then activate it");
  };

  const duplicate = async (f: FormRow) => {
    const { data, error } = await db.from("assessment_forms")
      .insert({ code: `${f.code}_COPY_${Date.now().toString(36).toUpperCase()}`, title: `${f.title} (copy)`, description: f.description, is_active: false, is_default: false, sections: f.sections })
      .select().single();
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-assessment-forms"] });
    select(data as FormRow);
    toast.success("Form duplicated");
  };

  const makeDefault = async (f: FormRow) => {
    const { error: e1 } = await db.from("assessment_forms").update({ is_default: false }).eq("is_default", true);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await db.from("assessment_forms").update({ is_default: true, is_active: true }).eq("id", f.id);
    if (e2) { toast.error(e2.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-assessment-forms"] });
    toast.success(`"${f.title}" is now the live public form`);
  };

  const removeForm = async (f: FormRow) => {
    if (f.is_default) { toast.error("Make another form the default first"); return; }
    const { error } = await db.from("assessment_forms").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    if (selectedId === f.id) { setSelectedId(null); setDraft(null); }
    void qc.invalidateQueries({ queryKey: ["admin-assessment-forms"] });
    toast.success("Form deleted");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const { error } = await db.from("assessment_forms").update({
      title: draft.title, description: draft.description,
      is_active: draft.is_active, sections: draft.sections,
      updated_at: new Date().toISOString(),
    }).eq("id", draft.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["admin-assessment-forms"] });
    toast.success("Form saved");
  };

  // ── draft mutators ──────────────────────────────────────────────────────────
  const mut = (fn: (d: FormRow) => void) => setDraft((d) => { if (!d) return d; const c = JSON.parse(JSON.stringify(d)) as FormRow; fn(c); return c; });
  const addSection = () => mut((d) => { d.sections.push({ title: `Section ${d.sections.length + 1}`, questions: [] }); });
  const moveSection = (i: number, dir: -1 | 1) => mut((d) => {
    const j = i + dir; if (j < 0 || j >= d.sections.length) return;
    [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
  });
  const removeSection = (i: number) => mut((d) => { d.sections.splice(i, 1); });
  const addQuestion = (si: number) => mut((d) => {
    d.sections[si].questions.push({ key: `q_${Date.now().toString(36)}`, label: "New question", type: "text", required: false, options: [] });
  });
  const moveQuestion = (si: number, qi: number, dir: -1 | 1) => mut((d) => {
    const qs = d.sections[si].questions; const j = qi + dir;
    if (j < 0 || j >= qs.length) return;
    [qs[qi], qs[j]] = [qs[j], qs[qi]];
  });
  const removeQuestion = (si: number, qi: number) => mut((d) => { d.sections[si].questions.splice(qi, 1); });
  const setQ = (si: number, qi: number, patch: Partial<Question>) => mut((d) => {
    d.sections[si].questions[qi] = { ...d.sections[si].questions[qi], ...patch };
  });

  const allKeys = draft?.sections.flatMap((s) => s.questions.map((q) => q.key)) ?? [];

  const tableMissing = !!error && /assessment_forms/.test((error as Error).message ?? "");

  return (
    <>
      <AdminPageHeader
        title="Assessment Forms"
        subtitle="Create and edit the forms prospects fill at /assessment — changes go live instantly"
        breadcrumb={[{ label: "Admin Home", to: "/admin" }, { label: "Assessment Forms" }]}
        actions={<Button size="sm" onClick={() => void newForm()}><Plus className="h-4 w-4 mr-1.5" /> New Form</Button>}
      />

      <div className="p-6">
        {tableMissing ? (
          <div className="card-surface p-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Form builder not installed yet</p>
            <p className="text-xs text-muted-foreground mt-1">Run sql/22 then sql/27 in the Supabase SQL editor, then reload this page.</p>
          </div>
        ) : isLoading ? (
          <div className="h-40 rounded-xl bg-muted animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Form list */}
            <div className="space-y-2">
              {forms.map((f) => (
                <div key={f.id}
                  className={cn("card-surface px-4 py-3 cursor-pointer", selectedId === f.id && "ring-2 ring-primary")}
                  onClick={() => select(f)}>
                  <div className="flex items-center gap-2">
                    {f.is_default && <Star className="h-3.5 w-3.5 text-gold fill-gold shrink-0" />}
                    <span className="font-medium text-sm flex-1 truncate">{f.title}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", f.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                      {f.is_active ? "Active" : "Draft"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{f.code} · {f.sections.reduce((n, s) => n + s.questions.length, 0)} questions</p>
                  <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                    {!f.is_default && (
                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => void makeDefault(f)}>
                        <Star className="h-3 w-3 mr-1" />Make live
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => void duplicate(f)}>
                      <Copy className="h-3 w-3 mr-1" />Duplicate
                    </Button>
                    {!f.is_default && (
                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 text-destructive" onClick={() => void removeForm(f)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {forms.length === 0 && (
                <div className="card-surface p-8 text-center text-sm text-muted-foreground">
                  No forms yet — click New Form.
                </div>
              )}
            </div>

            {/* Editor */}
            <div className="lg:col-span-2">
              {!draft ? (
                <div className="card-surface p-12 text-center text-sm text-muted-foreground">
                  Select a form on the left to edit it.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="card-surface p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Form title</Label>
                        <Input value={draft.title} onChange={(e) => mut((d) => { d.title = e.target.value; })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Intro text (shown to the prospect)</Label>
                        <Input value={draft.description ?? ""} onChange={(e) => mut((d) => { d.description = e.target.value; })} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Switch checked={draft.is_active} onCheckedChange={(v) => mut((d) => { d.is_active = v; })} />
                        Active {draft.is_default && <span className="text-[10px] text-gold font-medium">· LIVE PUBLIC FORM</span>}
                      </label>
                      <Button onClick={() => void save()} disabled={saving}>
                        <Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save form"}
                      </Button>
                    </div>
                  </div>

                  {draft.sections.map((sec, si) => (
                    <div key={si} className="card-surface p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Input className="font-medium" value={sec.title} onChange={(e) => mut((d) => { d.sections[si].title = e.target.value; })} />
                        <Button size="icon" variant="ghost" onClick={() => moveSection(si, -1)}><ChevronUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => moveSection(si, 1)}><ChevronDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeSection(si)}><Trash2 className="h-4 w-4" /></Button>
                      </div>

                      {sec.questions.map((q, qi) => (
                        <div key={qi} className="rounded-lg border border-border p-3.5 space-y-2.5 bg-muted/20">
                          <div className="flex items-center gap-2">
                            <Input className="flex-1" value={q.label} placeholder="Question label"
                              onChange={(e) => setQ(si, qi, { label: e.target.value })} />
                            <Select value={q.type} onValueChange={(v) => setQ(si, qi, { type: v })}>
                              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" onClick={() => moveQuestion(si, qi, -1)}><ChevronUp className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => moveQuestion(si, qi, 1)}><ChevronDown className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeQuestion(si, qi)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 items-center">
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <Switch checked={!!q.required} onCheckedChange={(v) => setQ(si, qi, { required: v })} /> Required
                              </label>
                              <span className="text-[10px] text-muted-foreground">key: {q.key}</span>
                            </div>
                            {q.type === "select" && (
                              <Input
                                placeholder="Options, comma-separated"
                                value={(q.options ?? []).join(", ")}
                                onChange={(e) => setQ(si, qi, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">Show only when</span>
                            <Select
                              value={q.show_if?.key ?? "__always__"}
                              onValueChange={(v) => setQ(si, qi, { show_if: v === "__always__" ? null : { key: v, equals: q.show_if?.equals ?? "" } })}>
                              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__always__">Always show</SelectItem>
                                {allKeys.filter((k) => k !== q.key).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {q.show_if && (
                              <>
                                <span className="text-muted-foreground">equals</span>
                                <Input className="h-8 w-32" value={q.show_if.equals}
                                  onChange={(e) => setQ(si, qi, { show_if: { key: q.show_if!.key, equals: e.target.value } })} />
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => addQuestion(si)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add question
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" onClick={addSection}><Plus className="h-4 w-4 mr-1.5" /> Add section</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
