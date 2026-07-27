/**
 * Webhook handler tests — Comms Hub Sprint 1.
 * Covers: signature validation, idempotency under duplicate delivery,
 * malformed payloads, oversized media. (Spec: thorough on exactly these.)
 */
import { describe, it, expect } from "vitest";
import {
  verifyMetaSignature, parseWebhookJobs, dropDuplicateInbound,
  isOversizedMedia, MAX_MEDIA_BYTES,
} from "@/lib/comms/waLogic";

const SECRET = "test_app_secret";

async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const validBody = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ id: "E1", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "15550001111", phone_number_id: "PNID" },
    contacts: [{ profile: { name: "Monty" }, wa_id: "919876543210" }],
    messages: [{ from: "919876543210", id: "wamid.MSG1", timestamp: "1760000000", type: "text", text: { body: "hello" } }],
  } }] }],
});

describe("signature verification", () => {
  it("accepts a valid HMAC signature", async () => {
    const header = await sign(SECRET, validBody);
    expect(await verifyMetaSignature(SECRET, validBody, header)).toBe(true);
  });
  it("rejects a signature made with the wrong secret", async () => {
    const header = await sign("wrong_secret", validBody);
    expect(await verifyMetaSignature(SECRET, validBody, header)).toBe(false);
  });
  it("rejects a tampered body", async () => {
    const header = await sign(SECRET, validBody);
    expect(await verifyMetaSignature(SECRET, validBody + "x", header)).toBe(false);
  });
  it("rejects missing or malformed headers", async () => {
    expect(await verifyMetaSignature(SECRET, validBody, null)).toBe(false);
    expect(await verifyMetaSignature(SECRET, validBody, "md5=abc")).toBe(false);
    expect(await verifyMetaSignature(SECRET, validBody, "sha256=")).toBe(false);
  });
});

describe("payload parsing", () => {
  it("extracts inbound message jobs", () => {
    const jobs = parseWebhookJobs(validBody);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("wa_inbound");
    expect((jobs[0].payload.message as { id: string }).id).toBe("wamid.MSG1");
    expect(jobs[0].payload.contactName).toBe("Monty");
  });
  it("extracts status jobs", () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.MSG1", status: "read", timestamp: "1", recipient_id: "919876543210" }] } }] }],
    });
    const jobs = parseWebhookJobs(body);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("wa_status");
  });
  it("returns [] on malformed JSON without throwing", () => {
    expect(parseWebhookJobs("{not json")).toEqual([]);
    expect(parseWebhookJobs("")).toEqual([]);
  });
  it("returns [] for non-WhatsApp objects and missing fields", () => {
    expect(parseWebhookJobs(JSON.stringify({ object: "page" }))).toEqual([]);
    expect(parseWebhookJobs(JSON.stringify({ object: "whatsapp_business_account" }))).toEqual([]);
    expect(parseWebhookJobs(JSON.stringify({ object: "whatsapp_business_account", entry: [{}] }))).toEqual([]);
  });
  it("skips messages without an id (idempotency key is mandatory)", () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ value: { messages: [{ from: "919876543210", type: "text" }] } }] }],
    });
    expect(parseWebhookJobs(body)).toEqual([]);
  });
});

describe("idempotency under duplicate delivery (Meta retries aggressively)", () => {
  it("drops a job whose provider_message_id already exists in the spine", () => {
    const jobs = parseWebhookJobs(validBody);
    const deduped = dropDuplicateInbound(jobs, new Set(["wamid.MSG1"]));
    expect(deduped).toHaveLength(0);
  });
  it("keeps new provider_message_ids", () => {
    const jobs = parseWebhookJobs(validBody);
    expect(dropDuplicateInbound(jobs, new Set(["wamid.OTHER"]))).toHaveLength(1);
  });
  it("triple delivery of the same webhook yields exactly one job", () => {
    const seen = new Set<string>();
    let written = 0;
    for (let i = 0; i < 3; i++) {
      for (const j of dropDuplicateInbound(parseWebhookJobs(validBody), seen)) {
        const id = (j.payload.message as { id: string }).id;
        seen.add(id); written++;
      }
    }
    expect(written).toBe(1);
  });
});

describe("oversized media", () => {
  it("rejects media above the 25MB cap", () => {
    expect(isOversizedMedia(MAX_MEDIA_BYTES + 1)).toBe(true);
  });
  it("accepts media at or below the cap, and tolerates unknown sizes", () => {
    expect(isOversizedMedia(MAX_MEDIA_BYTES)).toBe(false);
    expect(isOversizedMedia(1024)).toBe(false);
    expect(isOversizedMedia(null)).toBe(false);
    expect(isOversizedMedia(undefined)).toBe(false);
  });
});
