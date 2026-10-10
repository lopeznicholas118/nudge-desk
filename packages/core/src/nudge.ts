import type {Tier} from "./schemas";

/** How often you'd like to be in touch, per tier. */
export const CADENCE_DAYS: Record<Tier, number> = { close: 30, warm: 90, weak: 180 };

/** Score at which a contact shows as "due soon" (but not yet overdue). */
export const DUE_SOON_THRESHOLD = 0.8;

/** Policy: someone you've never logged contact with counts as twice overdue. */
const NEVER_CONTACTED_SCORE = 2;

const DAY_IN_MS = 86_400_000;
const TIER_PRIORITY: Record<Tier, number> = { close: 0, warm: 1, weak: 2 };

export type NudgeStatus = "never_contacted" | "overdue" | "due_soon" | "ok";

export interface NudgeCandidate {
  id: string;
  tier: Tier;
  lastInteractionAt: Date | null;
}

export interface NudgeAssessment {
  id: string;
  tier: Tier;
  /** daysSince / cadence. >= 1 means overdue. */
  score: number;
  daysSince: number | null;
  cadenceDays: number;
  status: NudgeStatus;
}

export function assessContact(candidate: NudgeCandidate, now: Date): NudgeAssessment {
  if (Number.isNaN(now.getTime())) throw new RangeError("`now` is an invalid Date");
  const { id, tier, lastInteractionAt } = candidate;
  const cadenceDays = CADENCE_DAYS[tier];

  if (lastInteractionAt === null) {
    return { id, tier, score: NEVER_CONTACTED_SCORE, daysSince: null, cadenceDays, status: "never_contacted" };
  }
  if (Number.isNaN(lastInteractionAt.getTime())) {
    throw new RangeError(`Invalid lastInteractionAt for contact ${id}`);
  }

  // Future-dated interactions (e.g. upcoming meetings) clamp to 0 days.
  const daysSince = Math.max(0, (now.getTime() - lastInteractionAt.getTime()) / DAY_IN_MS);
  const score = daysSince / cadenceDays;
  const status: NudgeStatus =
    score >= 1 ? "overdue" : score >= DUE_SOON_THRESHOLD ? "due_soon" : "ok";

  return {id, tier, score, daysSince, cadenceDays, status};
}

export interface RankOptions {
  limit?: number;
  minScore?: number;
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Highest score first; ties break by tier priority, then id, so output is deterministic. */
export function rankContacts(
  candidates: readonly NudgeCandidate[],
  now: Date,
  { limit = 10, minScore = 1 }: RankOptions = {},
): NudgeAssessment[] {
  return candidates
    .map((c) => assessContact(c, now))
    .filter((a) => a.score >= minScore)
    .sort(
      (a, b) =>
        b.score - a.score ||
        TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier] ||
        compare(a.id, b.id),
    )
    .slice(0, limit);
}

/** Plain-English reason shown next to each nudge ("why this nudge"). */
export function explainNudge(a: NudgeAssessment): string {
  if (a.daysSince === null) return "No contact logged yet.";
  const days = Math.floor(a.daysSince);
  const when = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return `Last contact ${when} (${a.tier} contacts: about every ${a.cadenceDays} days).`;
}