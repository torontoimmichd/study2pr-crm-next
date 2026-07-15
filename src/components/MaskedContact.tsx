"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

/**
 * MaskedContact — anti-poaching contact display.
 *
 * owner/admin        → always see the full value.
 * every other role   → see a masked value; clicking the eye reveals it for
 *                      15 seconds AND writes a row to contact_reveal_log
 *                      (owner sees who revealed what in v_contact_reveal_anomalies).
 *
 * Usage:
 *   <MaskedContact value={lead.phone} field="phone" entityType="lead" entityId={lead.id} />
 *   <MaskedContact value={lead.email} field="email" entityType="lead" entityId={lead.id} />
 */

interface Props {
  value: string | null | undefined;
  field: "phone" | "email" | "whatsapp";
  entityType: "lead" | "client" | "case";
  entityId: string;
  className?: string;
}

function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return p;
  return "•".repeat(Math.max(digits.length - 4, 2)) + digits.slice(-4);
}

function maskEmail(e: string): string {
  const at = e.indexOf("@");
  if (at <= 0) return e;
  return e[0] + "•••••" + e.slice(at);
}

export function MaskedContact({ value, field, entityType, entityId, className }: Props) {
  const { profile } = useAuth();
  const [revealed, setRevealed] = useState(false);

  if (!value) return null;

  const isAdmin = hasRole(profile, "owner", "admin");
  if (isAdmin) return <span className={className}>{value}</span>;

  const masked = field === "email" ? maskEmail(value) : maskPhone(value);

  const reveal = async () => {
    setRevealed(true);
    window.setTimeout(() => setRevealed(false), 15_000);
    // Log the reveal — non-blocking, errors logged but never thrown
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("contact_reveal_log").insert({
        staff_id: profile?.id,
        entity_type: entityType,
        entity_id: entityId,
        field,
      });
    } catch (err) {
      console.warn("[MaskedContact] reveal log failed", err);
    }
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="font-mono tracking-tight">{revealed ? value : masked}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground"
        title={revealed ? "Hide" : "Reveal (logged)"}
        onClick={() => (revealed ? setRevealed(false) : reveal())}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </Button>
    </span>
  );
}
