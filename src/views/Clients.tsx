"use client";

import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Users as UsersIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/TableSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { fmtDateIST } from "@/lib/format";
import { NewClientDialog } from "@/components/NewClientDialog";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const { data: clients, isLoading, refetch } = useQuery({
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
      const { data, error } = await q;
      if (error) throw error;

      // Count cases + family per client (parallel)
      const ids = (data ?? []).map((c) => c.id);
      const caseCounts = new Map<string, number>();
      const familyCounts = new Map<string, number>();
      if (ids.length) {
        const [casesRes, familyRes] = await Promise.all([
          supabase.from("cases").select("client_id").in("client_id", ids).eq("is_archived", false),
          supabase.from("family_members").select("principal_client_id").in("principal_client_id", ids),
        ]);
        casesRes.data?.forEach((c) => caseCounts.set(c.client_id, (caseCounts.get(c.client_id) ?? 0) + 1));
        familyRes.data?.forEach((f) => familyCounts.set(f.principal_client_id, (familyCounts.get(f.principal_client_id) ?? 0) + 1));
      }
      return (data ?? []).map((c) => ({
        ...c,
        active_cases: caseCounts.get(c.id) ?? 0,
        family_size: familyCounts.get(c.id) ?? 0,
      }));
    },
  });

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
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
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
