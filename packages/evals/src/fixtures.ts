import {InMemoryStore} from "@nudge/agent/testing";
import type {Language, Tier} from "@nudge/core";

/** The pinned clock. Every case runs "as of" this instant. */
export const NOW = new Date("2026-10-09T12:00:00Z");
const DAY_MS = 86_400_000;
export const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

/** Deterministic, valid v4-style UUIDs (the tools validate ids with z.uuid()). */
export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const ID = {maria: uid(1), ben: uid(2), priya: uid(3), alex: uid(4)} as const;

export type Person = {id: string; name: string; tier: Tier; lang?: Language; company?: string; notes?: string};
/** `days` is relative to NOW: negative is the past, positive is upcoming. */
export type Touch = {
  id: string;
  kind: "meeting" | "call" | "email" | "message";
  days: number;
  summary?: string;
};

export function network(people: readonly Person[], touches: readonly Touch[] = []): InMemoryStore {
  return new InMemoryStore({
    now: NOW,
    contacts: people.map((p) => ({
      id: p.id,
      fullName: p.name,
      tier: p.tier,
      preferredLanguage: p.lang ?? "en",
      company: p.company ?? null,
      notes: p.notes ?? null,
    })),
    interactions: touches.map((t) => ({
      contactId: t.id,
      kind: t.kind,
      occurredAt: daysFromNow(t.days),
      summary: t.summary ?? null,
    })),
  });
}

export const MARIA: Person = {
  id: ID.maria,
  name: "María Torres",
  tier: "warm",
  lang: "es",
  notes: "Mentors a robotics team. Met at a FIRST Robotics alumni event.",
};
export const MARIA_COFFEE: Touch = {
  id: ID.maria,
  kind: "meeting",
  days: -120,
  summary: "Coffee chat about her robotics mentoring",
};

export const BEN: Person = {
  id: ID.ben,
  name: "Ben Carter",
  tier: "close",
  company: "Acme",
  notes: "Former teammate. Interviewing for SWE roles.",
};
export const BEN_CALL: Touch = {id: ID.ben, kind: "call", days: -45, summary: "Talked through his resume"};
export const BEN_REVIEW: Touch = {id: ID.ben, kind: "meeting", days: 2, summary: "Resume review"};

export const PRIYA: Person = {id: ID.priya, name: "Priya Nair", tier: "weak"};
export const PRIYA_MSG: Touch = {
  id: ID.priya,
  kind: "message",
  days: -20,
  summary: "Congratulated her on the new job",
};

/** Never contacted, no notes. */
export const ALEX: Person = {id: ID.alex, name: "Alex Kim", tier: "warm"};