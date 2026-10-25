import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {MAX_NUDGES_PER_WEEK, planNudges} from "./nudge-plan";
import {TIERS, type Tier} from "./schemas";

const NOW = new Date("2026-10-09T12:00:00Z"); // a Friday; its week starts 2026-10-05
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const person = (id: string, tier: Tier, last: Date | null) => ({ id, tier, lastInteractionAt: last });

describe("planNudges", () => {
  it("plans overdue and never-contacted people for the current week", () => {
    const plan = planNudges(
      [
        person("a", "close", daysAgo(45)), // 1.5 -> overdue
        person("b", "warm", daysAgo(20)), // fine
        person("c", "warm", null), // never contacted
        person("d", "weak", daysAgo(100)), // 0.56 -> fine
      ],
      NOW,
    );
    expect(plan).toEqual([
      { contactId: "c", weekStart: "2026-10-05", score: 2, status: "never_contacted", reason: "No contact logged yet." },
      {
        contactId: "a",
        weekStart: "2026-10-05",
        score: 1.5,
        status: "overdue",
        reason: "Last contact 45 days ago (close contacts: about every 30 days).",
      },
    ]);
  });

  it("caps the plan at the weekly limit", () => {
    const many = Array.from({ length: 15 }, (_, i) => person(`id-${i}`, "warm", daysAgo(200 + i)));
    expect(planNudges(many, NOW)).toHaveLength(MAX_NUDGES_PER_WEEK);
    expect(planNudges(many, NOW, { limit: 3 })).toHaveLength(3);
  });

  it("is empty when nobody is overdue", () => {
    expect(planNudges([person("a", "warm", daysAgo(5))], NOW)).toEqual([]);
  });
});

describe("planNudges properties", () => {
  const dateArb = fc.date({
    min: new Date("2020-01-01T00:00:00Z"),
    max: new Date("2030-01-01T00:00:00Z"),
    noInvalidDate: true,
  });
  const candidatesArb = fc.uniqueArray(
    fc.record({
      id: fc.uuid(),
      tier: fc.constantFrom(...TIERS),
      lastInteractionAt: fc.option(dateArb, { nil: null }),
    }),
    { selector: (c) => c.id, maxLength: 40 },
  );

  it("always yields rows the database would accept", () => {
    fc.assert(
      fc.property(candidatesArb, (cs) => {
        const plan = planNudges(cs, NOW);
        const byId = new Map(cs.map((c) => [c.id, c]));
        expect(plan.length).toBeLessThanOrEqual(MAX_NUDGES_PER_WEEK);
        for (const row of plan) {
          expect(row.score).toBeGreaterThanOrEqual(1);
          expect(row.weekStart).toBe("2026-10-05");
          expect(row.status === "never_contacted").toBe(byId.get(row.contactId)?.lastInteractionAt === null);
          expect(row.reason.length).toBeLessThanOrEqual(300);
        }
      }),
    );
  });
});