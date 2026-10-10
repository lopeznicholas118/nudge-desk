import {describe, expect, it} from "vitest";
import {NewContactSchema, NewInteractionSchema} from "./schemas";

const CONTACT_ID = "3f0c1c7e-6a52-4b8e-9d1a-2b7f5e8c4a10";

describe("NewContactSchema", () => {
  it("trims, lowercases the email, and applies defaults", () => {
    const parsed = NewContactSchema.parse({
      full_name: "  Ada Lovelace ",
      email: " Ada@Example.COM ",
    });
    expect(parsed).toMatchObject({
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      preferred_language: "en",
      tier: "warm",
    });
  });

  it("rejects a blank name", () => {
    expect(NewContactSchema.safeParse({ full_name: "   " }).success).toBe(false);
  });

  it("rejects an unknown tier", () => {
    expect(NewContactSchema.safeParse({ full_name: "Ada", tier: "vip" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(NewContactSchema.safeParse({ full_name: "Ada", email: "not-an-email" }).success).toBe(false);
  });
});

describe("NewInteractionSchema", () => {
  const base = {
    contact_id: CONTACT_ID,
    kind: "meeting",
    occurred_at: "2026-10-01T15:00:00Z",
    source: "manual",
  };

  it("accepts a manual interaction without an external_id", () => {
    expect(NewInteractionSchema.safeParse(base).success).toBe(true);
  });

  it("requires external_id for google_calendar", () => {
    const result = NewInteractionSchema.safeParse({ ...base, source: "google_calendar" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["external_id"]);
  });

  it("accepts google_calendar with an external_id", () => {
    const input = { ...base, source: "google_calendar", external_id: "evt_123" };
    expect(NewInteractionSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a non-ISO date", () => {
    expect(NewInteractionSchema.safeParse({ ...base, occurred_at: "yesterday" }).success).toBe(false);
  });
});