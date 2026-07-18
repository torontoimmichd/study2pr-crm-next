"use client";

/**
 * PortalDashboard.tsx
 * Client-facing dashboard.
 * Shows: case status, document checklist, recent timeline events, assigned advisor.
 *
 * Auth: client logs in via magic-link OTP with their registered email.
 * We resolve their client record by matching auth.user.email to clients.email.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import {
  Crown, LogOut, CheckCircle2, AlertCircle, Clock, Upload,
  FileText, User, ChevronRight, RefreshCw, Download, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalPayments } from "@/components/PortalPayments";
import { Button } from "@/components/ui/button";
import { fmtDateIST, fmtRelative } from "@/lib/format";
import { toast } from "sonner";

// ─── stage labels ─────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  intake:              "Application intake",
  documents_pending:   "Gathering documents",
  documents_review:    "Documents under review",
  application_prep:    "Preparing application",
  submitted:           "Application submitted",
  biometrics:          "Biometrics",
  medical:             "Medical exam",
  background_check:    "Background check",
  decision_pending:    "Decision pending",
  approved:            "Approved",
  refused:             "Refused",
  appeal:              "Under appeal",
};

const STAGE_PROGRESS: Record<string, number> = {
  intake: 5, documents_pending: 15, documents_review: 25,
  application_prep: 40, submitted: 55, biometrics: 65,
  medical: 70, background_check: 80, decision_pending: 90,
  approved: 100, refused: 100, appeal: 85,
};

// ─── component ───────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  // Get authenticated user's email
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/login");
        return;
      }
      setAuthEmail(session.user.email ?? null);
    });
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  // Fetch client record by email
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["portal-client", authEmail],
    enabled: !!authEmail,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("clients")
        .select("id, full_name, email, phone, country_of_citizenship")
        .eq("email", authEmail!)
        .maybeSingle();
      if (error || !data) return null;
      return data as { id: string; full_name: string; email: string; phone: string | null; country_of_citizenship: string | null };
    },
  });

  // Fetch their most recent active case
  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["portal-case", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data: cases } = await supabase
        .from("cases")
        .select("id, case_code, current_stage_code, visa_type_id, target_submission_date, case_manager_id")
        .eq("client_id", client!.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cases) return null;

      const [visaRes, managerRes] = await Promise.all([
        cases.visa_type_id
          ? supabase.from("visa_types").select("label").eq("id", cases.visa_type_id).maybeSingle()
          : Promise.resolve({ data: null }),
        cases.case_manager_id
          ? supabase.from("staff_profiles").select("full_name, email").eq("id", cases.case_manager_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        ...cases,
        visa_label: (visaRes.data as { label: string } | null)?.label ?? "Immigration application",
        manager_name: (managerRes.data as { full_name: string } | null)?.full_name ?? null,
        manager_email: (managerRes.data as { email: string } | null)?.email ?? null,
      };
    },
  });

  // Fetch documents for their case
  const { data: docs } = useQuery({
    queryKey: ["portal-docs", caseData?.id],
    enabled: !!caseData?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("case_documents")
        .select("id, title, document_type, status, storage_path, expires_at, created_at, rejection_note")
        .eq("case_id", caseData!.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      return (data ?? []).map((d) => ({
        ...d,
        is_pending: !d.storage_path || d.storage_path.includes("_pending_") || d.status === "pending_upload",
      }));
    },
  });

  // Fetch recent timeline events
  const { data: timeline } = useQuery({
    queryKey: ["portal-timeline", caseData?.id],
    enabled: !!caseData?.id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("activity_timeline")
        .select("id, event_type, title, body, occurred_at, is_system")
        .eq("case_id", caseData!.id)
        .order("occurred_at", { ascending: false })
        .limit(10);
      return (data ?? []) as { id: string; event_type: string; title: string; body: string | null; occurred_at: string; is_system: boolean }[];
    },
  });

  const handleUpload = async (docId: string, file: File) => {
    if (!caseData) return;
    const ext = file.name.split(".").pop();
    const path = `cases/${caseData.id}/${docId}_client.${ext}`;
    const { error } = await supabase.storage.from("case-documents").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed: " + error.message); return; }
    await supabase.from("case_documents").update({ storage_path: path, status: "pending", storage_bucket: "case-documents" }).eq("id", docId);
    toast.success("Document uploaded — your advisor will review it shortly.");
  };

  const handleDownload = async (storagePath: string, title: string) => {
    const { data, error } = await supabase.storage
      .from("case-documents")
      .createSignedUrl(storagePath, 120); // 2-minute signed URL
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link. Please try again.");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = title;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isLoading = clientLoading || caseLoading;
  const stage = caseData?.current_stage_code ?? "intake";
  const progress = STAGE_PROGRESS[stage] ?? 10;
  const pendingDocs = docs?.filter((d) => d.is_pending) ?? [];
  const uploadedDocs = docs?.filter((d) => !d.is_pending) ?? [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your portal…</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5 flex items-center justify-center p-4">
        <div className="card-surface p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="font-display text-xl text-navy">Portal access not found</h2>
          <p className="text-sm text-muted-foreground">
            No client record was found for <strong>{authEmail}</strong>.<br />
            Please contact your advisor to link your portal access.
          </p>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy/5 via-background to-gold/5">
      {/* Portal header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-gold flex items-center justify-center">
              <Crown className="h-4 w-4 text-gold-foreground" />
            </div>
            <div>
              <div className="font-display text-sm text-navy leading-none">Study2PR</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Client Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{client.full_name}</span>
            <Button size="sm" variant="ghost" onClick={signOut} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1.5" />Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="font-display text-2xl text-navy">Hello, {client.full_name.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's a real-time update on your immigration journey.</p>
        </div>

        {!caseData ? (
          <div className="card-surface p-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No active case found. Your advisor will set one up shortly.</p>
          </div>
        ) : (
          <>
            {/* Case status card */}
            <div className="card-surface p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Your application</div>
                  <h2 className="font-display text-xl text-navy">{caseData.visa_label}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Case ref: {caseData.case_code}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">Current stage</div>
                  <div className="font-medium text-foreground capitalize">
                    {STAGE_LABELS[stage] ?? stage.replace(/_/g, " ")}
                  </div>
                  {caseData.target_submission_date && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Target: {fmtDateIST(caseData.target_submission_date)}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Advisor contact */}
              {caseData.manager_name && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{caseData.manager_name}</div>
                    <div className="text-xs text-muted-foreground">Your assigned advisor</div>
                  </div>
                  {caseData.manager_email && (
                    <a
                      href={`mailto:${caseData.manager_email}`}
                      className="ml-auto text-xs text-accent hover:underline"
                    >
                      Email advisor →
                    </a>
                  )}
                </div>
              )}
            </div>

            {client && <PortalPayments clientId={client.id} />}

            {/* Document checklist */}
            <div className="card-surface overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base text-navy">Document checklist</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {uploadedDocs.length} of {docs?.length ?? 0} uploaded
                  </p>
                </div>
                {docs && docs.length > 0 && (
                  <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${docs.length ? (uploadedDocs.length / docs.length) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>

              {!docs || docs.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Your document checklist will appear here once your advisor adds requirements.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {docs.map((d) => {
                    const isRejected = d.status === "rejected";
                    const isVerified = d.status === "verified";
                    const hasFile = !!d.storage_path && !d.is_pending;
                    return (
                      <li key={d.id} className={`flex items-start gap-3 px-4 py-3 ${isRejected ? "bg-red-50/60" : ""}`}>
                        <div className="shrink-0 mt-0.5">
                          {isVerified ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : isRejected ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : d.is_pending ? (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{d.title}</div>
                          <div className={`text-xs mt-0.5 ${isRejected ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            {isVerified
                              ? "✓ Verified by your advisor"
                              : isRejected
                              ? (d as unknown as Record<string, unknown>).rejection_note
                                ? `Re-upload needed: ${(d as unknown as Record<string, unknown>).rejection_note}`
                                : "Please re-upload — your advisor requested a new version"
                              : d.is_pending
                              ? d.expires_at
                                ? `Please upload by ${fmtDateIST(d.expires_at)}`
                                : "Awaiting your upload"
                              : `Uploaded ${fmtRelative(d.created_at)} — under review`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Download — available once a file has been uploaded */}
                          {hasFile && d.storage_path && (
                            <button
                              onClick={() => void handleDownload(d.storage_path!, d.title)}
                              title="Download your uploaded file"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors text-xs font-medium text-muted-foreground"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {/* Upload / re-upload */}
                          {(d.is_pending || isRejected) && (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleUpload(d.id, file);
                                }}
                              />
                              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors text-xs font-medium ${
                                isRejected
                                  ? "border-red-300 bg-red-50 hover:bg-red-100 text-red-700"
                                  : "border-border bg-background hover:bg-muted"
                              }`}>
                                <Upload className="h-3.5 w-3.5" />
                                {isRejected ? "Re-upload" : "Upload"}
                              </span>
                            </label>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Recent updates */}
            {timeline && timeline.length > 0 && (
              <div className="card-surface p-5">
                <h3 className="font-display text-base text-navy mb-4">Recent updates</h3>
                <ol className="space-y-4">
                  {timeline.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium capitalize">
                          {event.title.replace(/stage:/i, "").trim()}
                        </div>
                        {event.body && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.body}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground/60 mt-1">{fmtRelative(event.occurred_at)}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-4">
          This portal is provided by Study2PR Immigration Consulting. Questions? Email your advisor.
        </p>
      </main>
    </div>
  );
}
