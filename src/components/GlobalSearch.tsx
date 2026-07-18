"use client";

/**
 * GlobalSearch — Ctrl+K / button in the top bar, available on every page.
 * Result priority (Gaurav's spec): Applications → Clients → Leads → Tasks.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Briefcase, User, UserPlus, CheckSquare } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

interface Hit { id: string; label: string; sub?: string | null }

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data } = useQuery({
    queryKey: ["global-search", dq],
    enabled: open && dq.length >= 2,
    queryFn: async () => {
      const like = `%${dq}%`;
      const [cases, clients, leads, tasks] = await Promise.all([
        supabase.from("cases").select("id, case_code, client_id").ilike("case_code", like).limit(5),
        supabase.from("clients").select("id, full_name, phone, email")
          .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`).limit(5),
        supabase.from("leads").select("id, full_name, phone")
          .or(`full_name.ilike.${like},phone.ilike.${like}`).limit(5),
        supabase.from("tasks").select("id, title, case_id, lead_id").ilike("title", like)
          .in("status_code", ["open", "in_progress"]).limit(5),
      ]);
      return {
        cases: (cases.data ?? []).map((c) => ({ id: c.id, label: c.case_code ?? c.id.slice(0, 8) })) as Hit[],
        clients: (clients.data ?? []).map((c) => ({ id: c.id, label: c.full_name, sub: c.phone ?? c.email })) as Hit[],
        leads: (leads.data ?? []).map((l) => ({ id: l.id, label: l.full_name, sub: l.phone })) as Hit[],
        tasks: (tasks.data ?? []).map((t) => ({
          id: t.id, label: t.title,
          sub: t.case_id ? "on application" : t.lead_id ? "on lead" : null,
          // stash targets for navigation
          caseId: t.case_id as string | null, leadId: t.lead_id as string | null,
        })) as (Hit & { caseId?: string | null; leadId?: string | null })[],
      };
    },
  });

  const go = (path: string) => {
    setOpen(false);
    setQ("");
    navigate(path);
  };

  return (
    <>
      <Button
        variant="outline" size="sm"
        className="gap-2 text-muted-foreground font-normal w-56 justify-start"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        Search everything…
        <kbd className="ml-auto text-[10px] rounded border border-border px-1">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search applications, clients, leads, tasks…" value={q} onValueChange={setQ} />
        <CommandList>
          {dq.length < 2 ? (
            <CommandEmpty>Type at least 2 characters…</CommandEmpty>
          ) : (
            <>
              <CommandEmpty>No results for &quot;{dq}&quot;</CommandEmpty>
              {!!data?.cases.length && (
                <CommandGroup heading="Applications">
                  {data.cases.map((h) => (
                    <CommandItem key={"c" + h.id} value={"case-" + h.label} onSelect={() => go(`/cases/${h.id}`)}>
                      <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" /> {h.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!!data?.clients.length && (
                <CommandGroup heading="Clients">
                  {data.clients.map((h) => (
                    <CommandItem key={"cl" + h.id} value={"client-" + h.label + h.id} onSelect={() => go(`/clients/${h.id}`)}>
                      <User className="h-4 w-4 mr-2 text-muted-foreground" /> {h.label}
                      {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!!data?.leads.length && (
                <CommandGroup heading="Leads">
                  {data.leads.map((h) => (
                    <CommandItem key={"l" + h.id} value={"lead-" + h.label + h.id} onSelect={() => go(`/leads/${h.id}`)}>
                      <UserPlus className="h-4 w-4 mr-2 text-muted-foreground" /> {h.label}
                      {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!!data?.tasks.length && (
                <CommandGroup heading="Open tasks">
                  {data.tasks.map((h) => (
                    <CommandItem
                      key={"t" + h.id} value={"task-" + h.label + h.id}
                      onSelect={() => go(h.caseId ? `/cases/${h.caseId}` : h.leadId ? `/leads/${h.leadId}` : "/tasks")}
                    >
                      <CheckSquare className="h-4 w-4 mr-2 text-muted-foreground" /> {h.label}
                      {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
