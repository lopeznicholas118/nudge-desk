import {explainNudge, rankContacts, type NudgeCandidate} from "./nudge";
import {weekStart} from "./week";

export const MAX_NUDGES_PER_WEEK = 10;

export type PlannedNudge = {
  contactId: string;
  weekStart: string;
  score: number;
  status: "never_contacted" | "overdue";
  reason: string;
};

/** Decides which nudges to create for this week. Pure: the cron job only persists the result. */
export function planNudges(
  candidates: readonly NudgeCandidate[],
  now: Date,
  { limit = MAX_NUDGES_PER_WEEK }: { limit?: number } = {},
): PlannedNudge[] {
  const week = weekStart(now);
  // minScore 1 keeps only overdue and never-contacted people ("due soon" doesn't get a nudge).
  return rankContacts(candidates, now, {limit, minScore: 1}).map((a) => ({
    contactId: a.id,
    weekStart: week,
    score: Math.round(a.score * 1000) / 1000, // matches numeric(8,3)
    status: a.status === "never_contacted" ? "never_contacted" : "overdue",
    reason: explainNudge(a),
  }));
}