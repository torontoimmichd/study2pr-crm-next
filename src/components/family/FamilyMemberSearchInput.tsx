"use client";

// src/components/family/FamilyMemberSearchInput.tsx
// Debounced search across leads + clients.
import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export interface SearchResult {
  id: string;
  type: "lead" | "client";
  full_name: string;
  phone: string | null;
  email: string | null;
  existing_unit_name: string | null;
}

interface Props {
  organizationId: string;
  excludeId: string;
  renderRow: (person: SearchResult) => ReactNode;
}

export function FamilyMemberSearchInput({ organizationId, excludeId, renderRow }: Props) {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const term = `%${dq.trim()}%`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [leadsRes, clientsRes] = await Promise.all([
          (supabase as any)
            .from("leads")
            .select("id, full_name, phone, email, family_unit_id")
            .eq("organization_id", organizationId)
            .neq("id", excludeId)
            .or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
            .limit(10),
          (supabase as any)
            .from("clients")
            .select("id, full_name, phone, email, family_unit_id")
            .eq("organization_id", organizationId)
            .neq("id", excludeId)
            .or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
            .limit(10),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapRow = (r: any, type: "lead" | "client"): SearchResult => ({
          id: r.id,
          type,
          full_name: r.full_name || "—",
          phone: r.phone,
          email: r.email,
          existing_unit_name: null, // simplified: no join needed
        });

        const merged: SearchResult[] = [
          ...(leadsRes.data || []).map((r: any) => mapRow(r, "lead")),
          ...(clientsRes.data || []).map((r: any) => mapRow(r, "client")),
        ];
        setResults(merged);
      } catch (e) {
        console.error("Search failed", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [dq, organizationId, excludeId]);

  return (
    <div>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by name, phone, or email…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {loading && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="mt-3">
        {q.trim().length >= 2 && results.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-4">No matches found.</p>
        )}
        {results.map(r => <div key={`${r.type}-${r.id}`}>{renderRow(r)}</div>)}
      </div>
    </div>
  );
}
