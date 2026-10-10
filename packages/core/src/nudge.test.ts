import {describe, expect, it} from "vitest";
import {assessContact, explainNudge, rankContacts, type NudgeCandidate} from "./nudge";
import type {Tier} from "./schemas";

const NOW = new Date("2026-10-09T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const make = (tier: Tier, last: Date | null, id = "c1"): NudgeCandidate => ({
  id,
  tier,
  lastInteractionAt: last,
});

describe("assessContact", () => {
  it("is exactly overdue at one full cadence", () => {
    const a = assessContact(make("warm", daysAgo(90)), NOW);
    expect(a.score).toBe(1);
    expect(a.status).toBe("overdue");
  });

  it("is due soon just before the cadence", () => {
    expect(assessContact(make("warm", daysAgo(89)), NOW).status).toBe("due_soon");
  });

  it("is ok when recently contacted", () => {
    expect(assessContact(make("warm", daysAgo(50)), NOW).status).toBe("ok");
  });

  it("scores never-contacted people as 2 regardless of tier", () => {
    for (const tier of ["close", "warm", "weak"] as const) {
      const a = assessContact(make(tier, null), NOW);
      expect(a).toMatchObject({ score: 2, daysSince: null, status: "never_contacted" });
    }
  });

  it("clamps future-dated interactions to zero days", () => {
    const a = assessContact(make("close", daysAgo(-5)), NOW);
    expect(a.daysSince).toBe(0);
    expect(a.score).toBe(0);
  });

  it("throws on invalid dates instead of returning NaN", () => {
    expect(() => assessContact(make("warm", new Date("nope")), NOW)).toThrow(RangeError);
    expect(() => assessContact(make("warm", daysAgo(1)), new Date("nope"))).toThrow(RangeError);
  });
});

describe("rankContacts", () => {
  it("returns overdue contacts, most overdue first, and drops the rest", () => {
    const ranked = rankContacts(
      [make("close", daysAgo(31), "a"), make("warm", daysAgo(100), "b"), make("weak", daysAgo(10), "c")],
      NOW,
    );
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("breaks score ties by tier priority (close before warm)", () => {
    // close @ 30d = 1.0 and warm @ 90d = 1.0
    const ranked = rankContacts([make("warm", daysAgo(90), "w"), make("close", daysAgo(30), "c")], NOW);
    expect(ranked.map((r) => r.id)).toEqual(["c", "w"]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 5 }, (_, i) => make("warm", daysAgo(200 + i), `id-${i}`));
    expect(rankContacts(many, NOW, { limit: 3 })).toHaveLength(3);
  });

  it("does not mutate its input", () => {
    const input = [make("warm", daysAgo(100), "b"), make("close", daysAgo(31), "a")];
    const snapshot = [...input];
    rankContacts(input, NOW);
    expect(input).toEqual(snapshot);
  });
});

describe("explainNudge", () => {
  it("explains an overdue contact", () => {
    expect(explainNudge(assessContact(make("warm", daysAgo(94)), NOW))).toBe(
      "Last contact 94 days ago (warm contacts: about every 90 days).",
    );
  });

  it("explains a never-contacted person", () => {
    expect(explainNudge(assessContact(make("warm", null), NOW))).toBe("No contact logged yet.");
  });
});