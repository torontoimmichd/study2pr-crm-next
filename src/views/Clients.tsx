"use client";

// src/views/Clients.tsx
// v3 2026-07-27 — visual pass to match the Communications page.
// NOTHING about the data layer changed: the same single query, the same family
// grouping and the same hidden-top-level-duplicate logic as v2. Every stat below
// is DERIVED from rows already fetched, so this adds zero database calls and
// cannot introduce a new query error.
// v2 behaviour retained: family members render as indented sub-rows under their
// principal; a family member who is also a client shows their own client code and
// does not appear twice.

import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Users as UsersIcon, CornerDownRight, Briefcase, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { StatusPill } from "@/components/StatusPill";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtDateIST } from "@/lib/format";
import { NewClientDialog } from "@/components/NewClientDialog";

interface FamilyRow {
  id: string;
  principal_client_id: string;
  client_id: string | null;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  linked_code: string | null;
}

// ─── Stat tile ───────────────────────────────────────────────────────────────
function StatTile({
  label, value, icon, hint,
}: { label: string; value: number | string; icon: React.ReactNode; hint?: string }) {
  return (
    <div className="card-surface px-4 py-3 flex items-start gap-3">
      <div className="mt-1 h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="stat-value leading-none">{value}</div>
        <div className="stat-label mt-1.5">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clients-list", filter, debounced],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, client_code, full_name, email, phone, country_of_citizenship, is_active, onboarded_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter === "active") q = q.eq("is_active", true);
      if (filter === "inactive") q = q.eq("is_active", false);
      if (debounced) {
        const t = `%${debounced}%`;
        q = q.or(`full_name.ilike.${t},email.ilike.${t},phone.ilike.${t},client_code.ilike.${t}`);
      }
      const { data: rows, error } = await q;
      if (error) throw error;

      const ids = (rows ?? []).map((c) => c.id);
      const idSet = new Set(ids);
      const caseCounts = new Map<string, number>();
      let fams: FamilyRow[] = [];
      if (ids.length) {
        const [casesRes, famRes] = await Promise.all([
          supabase.from("cases").select("client_id").in("client_id", ids).eq("is_archived", false),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("family_members")
            .select("id, principal_client_id, client_id, full_name, relationship, phone")
            .in("principal_client_id", ids),
        ]);
        casesRes.data?.forEach((c) => caseCounts.set(c.client_id, (caseCounts.get(c.client_id) ?? 0) + 1));
        const rawFams = (famRes.data ?? []) as Omit<FamilyRow, "linked_code">[];
        const linkedIds = rawFams.map((f) => f.client_id).filter(Boolean) as string[];
        const codeMap = new Map<string, string | null>();
        if (linkedIds.length) {
          const { data: lc } = await supabase.from("clients").select("id, client_code").in("id", linkedIds);
          (lc ?? []).forEach((c) => codeMap.set(c.id, c.client_code));
        }
        fams = rawFams.map((f) => ({ ...f, linked_code: f.client_id ? (codeMap.get(f.client_id) ?? null) : null }));
      }

      const famByPrincipal: Record<string, FamilyRow[]> = {};
      fams.forEach((f) => { (famByPrincipal[f.principal_client_id] ??= []).push(f); });

      const hiddenTop = new Set(
        fams.filter((f) => f.client_id && idSet.has(f.principal_client_id) && f.client_id !== f.principal_client_id)
          .map((f) => f.client_id as string)
      );

      const principals = (rows ?? [])
        .filter((c) => !hiddenTop.has(c.id))
        .map((c) => ({
          ...c,
          active_cases: caseCounts.get(c.id) ?? 0,
          family_size: (famByPrincipal[c.id] ?? []).length,
        }));

      return { principals, famByPrincipal };
    },
  });

  const clients = data?.principals;
  const famByPrincipal = data?.famByPrincipal ?? {};

  // Derived from what we already have — no extra queries.
  const stats = useMemo(() => {
    const list = clients ?? [];
    return {
      total: list.length,
      active: list.filter((c) => c.is_active).length,
      families: list.filter((c) => c.family_size > 0).length,
      liveCases: list.reduce((n, c) => n + c.active_cases, 0),
    };
  }, [clients]);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Onboarded individuals & families"
        actions={
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1.5" /> New Client
          </Button>
        }
      />
      <div className="p-6 space-y-5">
        {/* ── At a glance ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Clients" value={stats.total} icon={<UsersIcon className="h-4 w-4" />}
            hint={filter === "all" ? "all statuses" : filter} />
          <StatTile label="Active" value={stats.active} icon={<UserCheck className="h-4 w-4" />}
            hint={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of list` : undefined} />
          <StatTile label="With family" value={stats.families} icon={<CornerDownRight className="h-4 w-4" />}
            hint="have linked members" />
          <StatTile label="Live applications" value={stats.liveCases} icon={<Briefcase className="h-4 w-4" />}
            hint="not archived" />
        </div>

        <div className="gold-rule" />

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "active", "inactive"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="pl-8 h-9" />
          </div>
        </div>

        <div className="card-surface overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : !clients || clients.length === 0 ? (
            <EmptyState
              icon={<UsersIcon className="h-5 w-5" />}
              title={debounced ? "No clients match that search" : "No clients yet"}
              description={debounced
                ? "Try a shorter search, or clear it to see everyone."
                : "Convert a qualified lead, or create a client manually."}
              action={<Button onClick={() => setOpen(true)} variant="outline"><Plus className="h-4 w-4 mr-1.5" />New Client</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Country</th>
                    <th className="text-left px-4 py-3 font-medium">Applications</th>
                    <th className="text-left px-4 py-3 font-medium">Family</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Onboarded</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const members = famByPrincipal[c.id] ?? [];
                    return (
                      <Fragment key={c.id}>
                        <tr className="border-t border-border hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={c.full_name} size="sm" />
                              <div className="min-w-0">
                                <Link to={`/clients/${c.id}`} className="font-medium hover:text-accent block truncate">
                                  {c.full_name}
                                </Link>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {c.client_code ?? "no code"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {c.phone ? <span className="block">{c.phone}</span> : null}
                            {c.email ? <span className="block truncate text-muted-foreground/80">{c.email}</span> : null}
                            {!c.phone && !c.email ? "—" : null}
                          </td>
                          <td className="px-4 py-3 text-xs">{c.country_of_citizenship ?? "—"}</td>
                          <td className="px-4 py-3">
                            {c.active_cases > 0 ? (
                              <StatusPill tone="info">{c.active_cases}</StatusPill>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">none</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {members.length > 0 ? (
                              <StatusPill tone="gold">{members.length}</StatusPill>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill tone={c.is_active ? "success" : "neutral"}>
                              {c.is_active ? "Active" : "Inactive"}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDateIST(c.onboarded_at)}
                          </td>
                        </tr>

                        {members.map((f) => {
                          const samePhone = !!f.phone && !!c.phone && f.phone.replace(/\s/g, "") === c.phone.replace(/\s/g, "");
                          return (
                            <tr key={`fam-${f.id}`} className="border-t border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2 pl-6 min-w-0">
                                  <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                                  <Avatar name={f.full_name} size="sm" />
                                  <div className="min-w-0">
                                    <Link
                                      to={f.client_id ? `/clients/${f.client_id}` : `/clients/${c.id}`}
                                      className="text-sm font-medium hover:text-accent block truncate"
                                    >
                                      {f.full_name}
                                    </Link>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {(f.relationship ?? "family member").replace(/_/g, " ")} of {c.full_name.split(" ")[0]}
                                      {f.linked_code ? <span className="font-mono"> · {f.linked_code}</span> : null}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                                {f.phone ?? "—"}
                                {samePhone && <span className="block text-[10px] italic text-muted-foreground/70">same as primary</span>}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground/60">—</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground/60">—</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground/60">—</td>
                              <td className="px-4 py-2.5">
                                <StatusPill tone="neutral">Family member</StatusPill>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground/60">—</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <NewClientDialog open={open} onOpenChange={setOpen} onCreated={() => { void refetch(); }} />
    </div>
  );
}
