import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {assessContact, rankContacts} from "./nudge";
import {TIERS} from "./schemas";

const NOW = new Date("2026-10-09T12:00:00Z");

const tierArb = fc.constantFrom(...TIERS);
const dateArb = fc.date({
  min: new Date("2020-01-01T00:00:00Z"),
  max: new Date("2030-01-01T00:00:00Z"),
  noInvalidDate: true,
});
const candidateArb = fc.record({
  id: fc.uuid(),
  tier: tierArb,
  lastInteractionAt: fc.option(dateArb, { nil: null }),
});
const candidatesArb = fc.uniqueArray(candidateArb, { selector: (c) => c.id, maxLength: 40 });

describe("assessContact properties", () => {
  it("score is always finite and non-negative", () => {
    fc.assert(
      fc.property(candidateArb, (c) => {
        const { score } = assessContact(c, NOW);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("a longer gap since contact never lowers the score", () => {
    fc.assert(
      fc.property(tierArb, dateArb, dateArb, (tier, a, b) => {
        const [older, newer] = a <= b ? [a, b] : [b, a];
        const sOlder = assessContact({id: "x", tier, lastInteractionAt: older}, NOW).score;
        const sNewer = assessContact({id: "x", tier, lastInteractionAt: newer}, NOW).score;
        expect(sOlder).toBeGreaterThanOrEqual(sNewer);
      }),
    );
  });

  it("with the same gap, closer tiers never score lower", () => {
    fc.assert(
      fc.property(fc.option(dateArb, { nil: null }), (last) => {
        const score = (tier: "close" | "warm" | "weak") =>
          assessContact({id: "x", tier, lastInteractionAt: last}, NOW).score;
        expect(score("close")).toBeGreaterThanOrEqual(score("warm"));
        expect(score("warm")).toBeGreaterThanOrEqual(score("weak"));
      }),
    );
  });
});

describe("rankContacts properties", () => {
  it("is sorted descending, respects minScore and limit", () => {
    fc.assert(
      fc.property(candidatesArb, fc.integer({ min: 0, max: 15 }), (cs, limit) => {
        const out = rankContacts(cs, NOW, { limit });
        expect(out.length).toBeLessThanOrEqual(limit);
        out.forEach((a, i) => {
          expect(a.score).toBeGreaterThanOrEqual(1);
          if (i > 0) expect(out[i - 1]!.score).toBeGreaterThanOrEqual(a.score);
        });
      }),
    );
  });

  it("does not depend on input order", () => {
    const shuffledPair = candidatesArb.chain((cs) =>
      fc
        .shuffledSubarray(cs, { minLength: cs.length, maxLength: cs.length })
        .map((shuffled) => ({cs, shuffled})),
    );
    fc.assert(
      fc.property(shuffledPair, ({cs, shuffled}) => {
        const opts = {limit: 1000};
        expect(rankContacts(shuffled, NOW, opts)).toEqual(rankContacts(cs, NOW, opts));
      }),
    );
  });
});