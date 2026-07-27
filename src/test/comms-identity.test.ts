/**
 * Identity matcher tests — Comms Hub Sprint 1.
 * The SQL resolve_identity is the runtime authority; these tests pin the
 * TS mirror + routing decisions. Phone variants per spec, ambiguity,
 * no-match, and collision with an existing identity.
 */
import { describe, it, expect } from "vitest";
import { normalizePhone, normalizeEmail, decideRouting } from "@/lib/comms/waLogic";

describe("normalizePhone → E.164 (default +91)", () => {
  it("handles '+91 98765 43210'", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("handles '09876543210' (leading zero)", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });
  it("handles '919876543210' (country code, no plus)", () => {
    expect(normalizePhone("919876543210")).toBe("+919876543210");
  });
  it("handles '98765-43210' (dashed 10-digit)", () => {
    expect(normalizePhone("98765-43210")).toBe("+919876543210");
  });
  it("all four spec variants normalize to the SAME handle", () => {
    const variants = ["+91 98765 43210", "09876543210", "919876543210", "98765-43210"];
    const set = new Set(variants.map(normalizePhone));
    expect(set.size).toBe(1);
    expect([...set][0]).toBe("+919876543210");
  });
  it("preserves non-Indian numbers with explicit country code", () => {
    expect(normalizePhone("+1 647 783 2922")).toBe("+16477832922");
    expect(normalizePhone("0016477832922")).toBe("+16477832922"); // 00 international prefix
  });
  it("handles WhatsApp wa_id format (digits, country code, no plus)", () => {
    expect(normalizePhone("16477832922")).toBe("+16477832922");
  });
  it("rejects garbage and too-short input", () => {
    expect(normalizePhone("hello")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Gaurav@Study2PR.IN ")).toBe("gaurav@study2pr.in");
  });
  it("empty → null", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("decideRouting — never guesses", () => {
  it("match → routes to the owner, no triage", () => {
    const d = decideRouting({ status: "match", client_id: "c-1", lead_id: null });
    expect(d).toEqual({ triage: false, createLead: false, clientId: "c-1", leadId: null });
  });
  it("match on a lead → lead ownership", () => {
    const d = decideRouting({ status: "match", client_id: null, lead_id: "l-1" });
    expect(d.leadId).toBe("l-1");
    expect(d.triage).toBe(false);
  });
  it("AMBIGUOUS → triage, and NEVER picks a candidate (ids stripped)", () => {
    // collision: the same handle claimed by two different owners
    const d = decideRouting({ status: "ambiguous", client_id: "c-1", lead_id: "l-9" });
    expect(d.triage).toBe(true);
    expect(d.clientId).toBeNull();   // must not guess c-1
    expect(d.leadId).toBeNull();     // must not guess l-9
    expect(d.createLead).toBe(false); // no phantom leads for known-but-ambiguous handles
  });
  it("no match → auto-create Lead AND still triage for human routing", () => {
    const d = decideRouting({ status: "none" });
    expect(d.createLead).toBe(true);
    expect(d.triage).toBe(true);
    expect(d.clientId).toBeNull();
  });
});

describe("collision with an existing identity (backfill semantics)", () => {
  // sql/37 marks the existing identity link_status='conflict' when a second
  // owner claims the same handle; resolve_identity then reports 'ambiguous'.
  // The routing contract for that state is pinned here:
  it("conflict-flagged identity behaves as ambiguous → triage", () => {
    const d = decideRouting({ status: "ambiguous" });
    expect(d.triage).toBe(true);
    expect(d.createLead).toBe(false);
  });
});
