/**
 * taskEngine.ts
 * Client-side automatic task creation rules.
 * Called after lead creation, stage transitions, and case creation.
 * All inserts are fire-and-forget — errors are swallowed silently.
 */

import { supabase } from "@/integrations/supabase/client";
import { writeTimeline } from "@/lib/timeline";

// ─── helpers ────────────────────────────────────────────────────────────────

function hoursFromNow(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d.toISOString();
}

function daysFromNow(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

interface TaskRow {
  title: string;
  description?: string | null;
  due_at: string;
  priority: "low" | "normal" | "high" | "urgent";
  status_code: "open";
  source: "engine";
  lead_id?: string | null;
  case_id?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
}

/**
 * Idempotent insert: skips any row whose title already exists as an open
 * engine task for the same lead or case.  Prevents duplicate tasks when a
 * stage is saved more than once.
 */
async function insertTasks(
  rows: TaskRow[],
  dedupEntity?: { field: "lead_id" | "case_id"; id: string },
): Promise<void> {
  if (rows.length === 0) return;
  try {
    let newRows = rows;

    if (dedupEntity) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("tasks")
        .select("title")
        .eq(dedupEntity.field, dedupEntity.id)
        .eq("source", "engine")
        .is("completed_at", null);

      const existingTitles = new Set(
        (existing ?? []).map((t: { title: string }) => t.title),
      );
      newRows = rows.filter((r) => !existingTitles.has(r.title));
    }

    if (newRows.length === 0) {
      console.info("[taskEngine] all tasks already exist — skipping insert");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("tasks").insert(newRows);
    if (error) {
      console.warn("[taskEngine] insert error:", error.message);
      return;
    }

    // Log each created task to the activity timeline
    for (const row of newRows) {
      void writeTimeline({
        event_type: "task_created",
        title: `Task: ${row.title}`,
        body: row.description ?? null,
        lead_id: row.lead_id ?? null,
        case_id: row.case_id ?? null,
        is_system: true,
      });
    }
  } catch (err) {
    console.warn("[taskEngine] unexpected error:", err);
  }
}

// ─── Lead created ────────────────────────────────────────────────────────────
/**
 * Called immediately after a new lead is inserted.
 * Creates:
 *   - First call task due in 2 hours (urgent)
 *   - Day 1, 3, 7, 14 follow-up tasks
 */
export async function createLeadTasks(
  leadId: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    lead_id: leadId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  const tasks: TaskRow[] = [
    {
      ...base,
      title: "First call — introduce & qualify",
      description: "Call within 2 hours of enquiry. Introduce the firm, understand the client's goals, and qualify the lead.",
      due_at: hoursFromNow(2),
      priority: "urgent",
    },
    {
      ...base,
      title: "Day 1 follow-up",
      description: "Check if the lead has reviewed any information sent. Answer questions and gauge interest.",
      due_at: daysFromNow(1),
      priority: "high",
    },
    {
      ...base,
      title: "Day 3 follow-up",
      description: "Third-day touchpoint. Offer to schedule a consultation if not done yet.",
      due_at: daysFromNow(3),
      priority: "normal",
    },
    {
      ...base,
      title: "Day 7 follow-up",
      description: "Week-one check-in. Re-confirm interest and assess any change in situation.",
      due_at: daysFromNow(7),
      priority: "normal",
    },
    {
      ...base,
      title: "Day 14 follow-up",
      description: "Two-week touchpoint. If no progress, assess cooling and consider moving to waiting or cold.",
      due_at: daysFromNow(14),
      priority: "low",
    },
  ];

  await insertTasks(tasks, { field: "lead_id", id: leadId });
}

// ─── Stage transition tasks ──────────────────────────────────────────────────
/**
 * Called after a lead stage changes.
 * Creates contextual tasks based on the new stage.
 */
export async function createStageTasks(
  leadId: string,
  newStage: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    lead_id: leadId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  // Stage keys must match PHASE2 lifecycle_state values:
  // new_enquiry → contacted → assessed → proposal_sent → negotiating → waiting / nurturing → converted / cold / not_eligible / lost
  const tasksByStage: Record<string, TaskRow[]> = {

    // ── contacted: first connection made — qualify fast ────────────────────────
    contacted: [
      {
        ...base,
        title: "Send eligibility questionnaire",
        description: "Share the initial eligibility form / questionnaire with the lead so we can assess their profile.",
        due_at: hoursFromNow(4),
        priority: "high",
      },
      {
        ...base,
        title: "Day 3 follow-up — questionnaire received?",
        description: "Check if the lead has returned the questionnaire. Chase if not; book assessment call if yes.",
        due_at: daysFromNow(3),
        priority: "normal",
      },
    ],

    // ── assessed: eligibility reviewed — prepare and deliver proposal ──────────
    assessed: [
      {
        ...base,
        title: "Prepare eligibility summary & proposal",
        description: "Draft the assessment result, recommended pathway, timeline, and quoted fees. Review before sending.",
        due_at: hoursFromNow(24),
        priority: "high",
      },
      {
        ...base,
        title: "Book consultation call to present assessment",
        description: "Schedule a 30-min call to walk the lead through the assessment result and answer questions.",
        due_at: daysFromNow(2),
        priority: "normal",
      },
    ],

    // ── proposal_sent: proposal delivered — follow up until decision ───────────
    proposal_sent: [
      {
        ...base,
        title: "Proposal follow-up — Day 3",
        description: "Check if the client has reviewed the proposal. Answer questions on fees and process.",
        due_at: daysFromNow(3),
        priority: "high",
      },
      {
        ...base,
        title: "Proposal follow-up — Day 8",
        description: "Second follow-up on proposal. Address any objections or concerns.",
        due_at: daysFromNow(8),
        priority: "normal",
      },
      {
        ...base,
        title: "Proposal follow-up — Day 14",
        description: "Two-week proposal check. If no decision, explore barriers and offer alternatives.",
        due_at: daysFromNow(14),
        priority: "normal",
      },
      {
        ...base,
        title: "Proposal decision deadline — Day 30",
        description: "Final follow-up. If no engagement, consider moving to cold or adjusting offer.",
        due_at: daysFromNow(30),
        priority: "low",
      },
    ],

    // ── negotiating: in active discussion — resolve objections and close ────────
    negotiating: [
      {
        ...base,
        title: "Identify objection and send response",
        description: "Document the main blocker (fee, timeline, eligibility concern) and prepare a tailored response or counter-offer.",
        due_at: hoursFromNow(24),
        priority: "high",
      },
      {
        ...base,
        title: "Negotiation follow-up — Day 5",
        description: "Follow up on the counter-offer or response sent. Gauge readiness to sign.",
        due_at: daysFromNow(5),
        priority: "high",
      },
      {
        ...base,
        title: "Escalate to senior advisor — Day 10",
        description: "If still no agreement, loop in senior advisor for a final offer or alternative pathway discussion.",
        due_at: daysFromNow(10),
        priority: "urgent",
      },
    ],

    // ── waiting: not yet eligible — maintain warm contact ─────────────────────
    waiting: [
      {
        ...base,
        title: "Waiting period — Week 1 check-in",
        description: "Touch base to confirm the waiting situation is unchanged. Note any updates to their profile.",
        due_at: daysFromNow(7),
        priority: "low",
      },
      {
        ...base,
        title: "Waiting period — Month 1 review",
        description: "Review whether the lead's situation has changed. Re-assess eligibility if relevant milestone passed.",
        due_at: daysFromNow(30),
        priority: "low",
      },
    ],

    // ── nurturing: long-term pipeline — keep warm with regular touch ───────────
    nurturing: [
      {
        ...base,
        title: "Nurturing touch — Week 2",
        description: "Send a relevant update (draw result, policy change, tips) to keep the lead warm and engaged.",
        due_at: daysFromNow(14),
        priority: "low",
      },
      {
        ...base,
        title: "Nurturing call — Month 1",
        description: "Schedule a brief call to re-evaluate eligibility and reassess readiness to proceed.",
        due_at: daysFromNow(30),
        priority: "low",
      },
    ],
  };

  const tasks = tasksByStage[newStage];
  if (tasks && tasks.length > 0) {
    await insertTasks(tasks, { field: "lead_id", id: leadId });
  }
}

// ─── Case created ─────────────────────────────────────────────────────────────
/**
 * Called after a new case is created.
 * Creates:
 *   - Onboarding call task
 *   - Document checklist kickoff task
 */
export async function createCaseTasks(
  caseId: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    case_id: caseId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  const tasks: TaskRow[] = [
    {
      ...base,
      title: "Client onboarding call",
      description: "Welcome the client to the firm. Walk through the case process, timeline, and next steps. Collect any outstanding details.",
      due_at: hoursFromNow(24),
      priority: "urgent",
    },
    {
      ...base,
      title: "Send document checklist",
      description: "Email the full document checklist to the client. Explain each requirement and set an initial submission deadline.",
      due_at: daysFromNow(1),
      priority: "high",
    },
    {
      ...base,
      title: "Confirm payment arrangements",
      description: "Verify the payment plan is in place and the first instalment has been received.",
      due_at: daysFromNow(2),
      priority: "high",
    },
    {
      ...base,
      title: "Week 2 — document collection status",
      description: "Review document checklist progress with the client. Follow up on any missing items.",
      due_at: daysFromNow(14),
      priority: "normal",
    },
  ];

  await insertTasks(tasks, { field: "case_id", id: caseId });
}

// ─── Document follow-up (case-level) ─────────────────────────────────────────
/**
 * Called when documents are overdue or when a counselor triggers a chase.
 * Creates escalating follow-up tasks at Day 5 / 10 / 14 / 21.
 */
export async function createDocFollowUpTasks(
  caseId: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    case_id: caseId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  await insertTasks([
    {
      ...base,
      title: "Doc follow-up — Day 5",
      description: "First document chase. Check which items the client has ready and clarify any questions.",
      due_at: daysFromNow(5),
      priority: "normal",
    },
    {
      ...base,
      title: "Doc follow-up — Day 10",
      description: "Second chase. List what is still outstanding and set a hard deadline for remaining items.",
      due_at: daysFromNow(10),
      priority: "high",
    },
    {
      ...base,
      title: "Counselor call — Day 14 (docs overdue)",
      description: "Book a call to troubleshoot why documents haven't arrived. Address any confusion or barriers.",
      due_at: daysFromNow(14),
      priority: "high",
    },
    {
      ...base,
      title: "Manager escalation — Day 21 (docs still missing)",
      description: "Escalate to manager. Assess whether to pause the case or send a final notice to the client.",
      due_at: daysFromNow(21),
      priority: "urgent",
    },
  ], { field: "case_id", id: caseId });
}

// ─── Payment follow-up (invoice-level) ───────────────────────────────────────
/**
 * Called after an invoice is generated / sent.
 * Creates payment reminder tasks at Day 3 / 7 / 14.
 */
export async function createPaymentFollowUpTasks(
  caseId: string,
  invoiceRef: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    case_id: caseId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  await insertTasks([
    {
      ...base,
      title: `Payment reminder — Day 3 (${invoiceRef})`,
      description: "Friendly reminder that the invoice is outstanding. Offer to answer any billing questions.",
      due_at: daysFromNow(3),
      priority: "normal",
    },
    {
      ...base,
      title: `Payment overdue — Day 7 (${invoiceRef})`,
      description: "Follow up on unpaid invoice. Confirm if the client needs a payment plan or has banking issues.",
      due_at: daysFromNow(7),
      priority: "high",
    },
    {
      ...base,
      title: `Payment escalation — Day 14 (${invoiceRef})`,
      description: "Escalate to manager. Consider placing a hold on case progress until payment is received.",
      due_at: daysFromNow(14),
      priority: "urgent",
    },
  ], { field: "case_id", id: caseId });
}

// ─── Case stage transition tasks ─────────────────────────────────────────────
/**
 * Called after a case's current_stage_code changes.
 * Creates contextual tasks based on the new case stage.
 * Stage codes must match the case_stages_ref table.
 */
export async function createCaseStageTasks(
  caseId: string,
  newStage: string,
  assignedTo?: string | null,
  createdBy?: string | null,
): Promise<void> {
  const base: Omit<TaskRow, "title" | "description" | "due_at" | "priority"> = {
    status_code: "open",
    source: "engine",
    case_id: caseId,
    assigned_to: assignedTo ?? null,
    created_by: createdBy ?? null,
  };

  const tasksByStage: Record<string, TaskRow[]> = {

    // ── onboarding: case just created — welcome and set up ────────────────────
    onboarding: [
      {
        ...base,
        title: "Send client welcome pack",
        description: "Email the welcome letter, portal login details, and case timeline overview to the client.",
        due_at: hoursFromNow(24),
        priority: "high",
      },
      {
        ...base,
        title: "Confirm retainer / engagement agreement signed",
        description: "Verify the signed retainer agreement has been received and filed.",
        due_at: daysFromNow(2),
        priority: "high",
      },
    ],

    // ── docs_collection: awaiting documents ───────────────────────────────────
    docs_collection: [
      {
        ...base,
        title: "Send full document checklist",
        description: "Share the complete checklist of required documents with the client, with deadlines for each item.",
        due_at: hoursFromNow(4),
        priority: "high",
      },
      {
        ...base,
        title: "Document collection — Week 2 review",
        description: "Review which documents have arrived. Chase any outstanding items with a firm deadline.",
        due_at: daysFromNow(14),
        priority: "normal",
      },
    ],

    // ── application_prep: documents in hand — prepare application ──────────────
    application_prep: [
      {
        ...base,
        title: "Review all documents for completeness",
        description: "Check every document against the checklist. Flag any gaps, expiry issues, or translation needs.",
        due_at: hoursFromNow(48),
        priority: "high",
      },
      {
        ...base,
        title: "Draft application forms",
        description: "Complete all government forms. Double-check dates, names, and supporting evidence references.",
        due_at: daysFromNow(5),
        priority: "high",
      },
      {
        ...base,
        title: "Client review and sign-off",
        description: "Send draft application to client for review. Collect written approval before submission.",
        due_at: daysFromNow(7),
        priority: "normal",
      },
    ],

    // ── submitted: application filed — monitor and advise ─────────────────────
    submitted: [
      {
        ...base,
        title: "Confirm submission receipt / acknowledgement",
        description: "Verify the government acknowledgement of receipt has been received. Log the file / AOR number.",
        due_at: hoursFromNow(24),
        priority: "high",
      },
      {
        ...base,
        title: "Advise client of processing timeline",
        description: "Send client the current processing time estimates and explain what to expect next.",
        due_at: daysFromNow(1),
        priority: "normal",
      },
      {
        ...base,
        title: "Month 1 processing check-in",
        description: "Check for any government correspondence or status updates. Update client if anything new.",
        due_at: daysFromNow(30),
        priority: "low",
      },
    ],

    // ── processing: under government review ───────────────────────────────────
    processing: [
      {
        ...base,
        title: "Monitor IRCC / government portal for updates",
        description: "Check the file status weekly. Log any new correspondence in the IRCC inbox.",
        due_at: daysFromNow(7),
        priority: "low",
      },
      {
        ...base,
        title: "Prepare client for biometrics / medical (if required)",
        description: "Advise client of any upcoming biometric or medical examination requirements and deadlines.",
        due_at: daysFromNow(3),
        priority: "normal",
      },
    ],

    // ── approved: positive decision received ──────────────────────────────────
    approved: [
      {
        ...base,
        title: "Notify client of approval",
        description: "Call and email the client immediately. Explain next steps (COPR, PRTD, activation, etc.).",
        due_at: hoursFromNow(2),
        priority: "urgent",
      },
      {
        ...base,
        title: "Guide client through post-approval steps",
        description: "Walk through landing requirements, confirmation of PR, SIN application, or next permit steps.",
        due_at: daysFromNow(3),
        priority: "high",
      },
      {
        ...base,
        title: "Request referral / Google review",
        description: "Ask the client for a referral or online review while satisfaction is high.",
        due_at: daysFromNow(7),
        priority: "low",
      },
    ],

    // ── refused: negative decision ────────────────────────────────────────────
    refused: [
      {
        ...base,
        title: "Call client — explain refusal reasons",
        description: "Explain the grounds for refusal clearly and compassionately. Do not discuss appeal options until they are assessed.",
        due_at: hoursFromNow(4),
        priority: "urgent",
      },
      {
        ...base,
        title: "Assess appeal / reconsideration options",
        description: "Review the refusal letter with the lead advisor. Determine if IAD, judicial review, or reapplication is viable.",
        due_at: daysFromNow(3),
        priority: "high",
      },
    ],

  };

  const tasks = tasksByStage[newStage];
  if (tasks && tasks.length > 0) {
    await insertTasks(tasks, { field: "case_id", id: caseId });
  }
}

// ─── Callback retry task (missed call) ───────────────────────────────────────
/**
 * Called from LogCallDialog after a no_answer or busy outcome.
 * Creates a single "Call back" task due in 2 hours for the assigned advisor.
 */
export async function createCallbackTask(opts: {
  leadId?: string | null;
  caseId?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const title = "Call back — missed / no answer";

  const dedupEntity = opts.leadId
    ? { field: "lead_id" as const, id: opts.leadId }
    : opts.caseId
    ? { field: "case_id" as const, id: opts.caseId }
    : undefined;

  await insertTasks(
    [
      {
        title,
        description: "Previous call attempt was unanswered. Try again within 2 hours.",
        due_at: hoursFromNow(2),
        priority: "high",
        status_code: "open",
        source: "engine",
        lead_id: opts.leadId ?? null,
        case_id: opts.caseId ?? null,
        assigned_to: opts.assignedTo ?? null,
        created_by: opts.createdBy ?? null,
      },
    ],
    dedupEntity,
  );
}
