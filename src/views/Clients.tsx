"use client";

// src/views/Clients.tsx — v2 2026-07-18: family members render as indented
// sub-rows under their principal client (Gaurav's mockup). A family member who
// is ALSO a client (linked via family_members.client_id) shows their own client
// code and no longer appears as a duplicate top-level row.

import { Fragment, useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Users as UsersIcon, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
        // Resolve client codes for family members who are clients themselves
        const linkedIds = rawFams.map((f) => f.client_id).filter(Boolean) as string[];
        const codeMap = new Map<string, string | null>();
        if (linkedIds.length) {
          const { data: lc } = await supabase.from("clients").select("id, client_code").in("id", linkedIds);
          (lc ?? []).forEach((c) => codeMap.set(c.id, c.client_code));
        }
        fams = rawFams.map((f) => ({ ...f, linked_code: f.client_id ? (codeMap.get(f.client_id) ?? null) : null }));
      }

      // Group family members under their principal
      const famByPrincipal: Record<string, FamilyRow[]> = {};
      fams.forEach((f) => { (famByPrincipal[f.principal_client_id] ??= []).push(f); });

      // Hide a top-level client row if they appear as a family member of another
      // client that is ALSO on this page (they render as a sub-row instead)
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
      <div className="p-6 space-y-4">
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
              title="No clients yet"
              description="Convert a qualified lead, or create a client manually."
              action={<Button onClick={() => setOpen(true)} variant="outline"><Plus className="h-4 w-4 mr-1.5" />New Client</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Code</th>
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Country</th>
                  <th className="text-left px-4 py-3 font-medium">Active cases</th>
                  <th className="text-left px-4 py-3 font-medium">Family</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.client_code ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link to={`/clients/${c.id}`} className="font-medium hover:text-accent">{c.full_name}</Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-3 text-xs">{c.country_of_citizenship ?? "—"}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{c.active_cases}</span></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{c.family_size}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${c.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateIST(c.onboarded_at)}</td>
                    </tr>
                    {(famByPrincipal[c.id] ?? []).map((f) => {
                      const samePhone = !!f.phone && !!c.phone && f.phone.replace(/\s/g, "") === c.phone.replace(/\s/g, "");
                      return (
                        <tr key={`fam-${f.id}`} className="border-t border-border/60 bg-muted/20 hover:bg-muted/40">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.linked_code ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 pl-5">
                              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <UsersIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                {f.client_id ? (
                                  <Link to={`/clients/${f.client_id}`} className="text-sm font-medium hover:text-accent">{f.full_name}</Link>
                                ) : (
                                  <Link to={`/clients/${c.id}`} className="text-sm font-medium hover:text-accent">{f.full_name}</Link>
                                )}
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {(f.relationship ?? "family member").replace(/_/g, " ")} of {c.full_name.split(" ")[0]}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {f.phone ?? "—"}
                            {samePhone && <span className="block text-[10px] italic text-muted-foreground/70">same as primary</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-border bg-card text-muted-foreground">
                              Family Member
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">—</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <NewClientDialog open={open} onOpenChange={setOpen} onCreated={() => { void refetch(); }} />
    </div>
  );
}
