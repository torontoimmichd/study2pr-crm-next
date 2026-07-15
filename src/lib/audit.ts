import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STAGE_CHANGE"
  | "STATUS_CHANGE"
  | "CONVERT"
  | "LOGIN"
  | "UPLOAD"
  | "PAYMENT";

interface AuditArgs {
  action: AuditAction | string;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, unknown> | null;
}

/**
 * Insert a row into audit_log. Always non-blocking — errors are logged but
 * never thrown so they cannot break the user-facing flow.
 */
export async function writeAudit({ action, entity_type, entity_id, changes = null }: AuditArgs): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const actor_id = userRes.user?.id ?? null;

    const { error } = await supabase.from("audit_log").insert({
      action,
      entity_type,
      entity_id,
      actor_id,
      actor_type: "staff",
      changes: changes as never,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[audit] insert failed", error.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[audit] threw", err);
  }
}
