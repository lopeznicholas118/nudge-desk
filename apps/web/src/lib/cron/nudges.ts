import {planNudges, TierSchema} from "@nudge/core";
import type {DbClient} from "@nudge/db";
import {z} from "zod";

const Row = z.object({
  id: z.uuid(),
  tier: TierSchema,
  last_interaction_at: z.string().nullable(),
});

/**
 * Creates this week's nudges for ONE user.
 * Idempotent: the unique (user_id, contact_id, week_start) constraint plus
 * ON CONFLICT DO NOTHING means a rerun, or an overlapping run, creates nothing new.
 * (Reads at most the API's page size, 1000 contacts, which is plenty for this app.)
 */
export async function generateNudgesForUser(
  db: DbClient,
  userId: string,
  now: Date,
): Promise<{ planned: number; created: number }> {
  const { data, error } = await db
    .from("contacts_with_last_interaction")
    .select("id, tier, last_interaction_at")
    .eq("user_id", userId);
  if (error) throw error;

  const candidates = z.array(Row).parse(data ?? []).map((r) => ({
    id: r.id,
    tier: r.tier,
    lastInteractionAt: r.last_interaction_at === null ? null : new Date(r.last_interaction_at),
  }));

  const plan = planNudges(candidates, now);
  if (plan.length === 0) return { planned: 0, created: 0 };

  const { data: inserted, error: insertError } = await db
    .from("nudges")
    .upsert(
      plan.map((p) => ({
        user_id: userId,
        contact_id: p.contactId,
        week_start: p.weekStart,
        score: p.score,
        status: p.status,
        reason: p.reason,
      })),
      { onConflict: "user_id,contact_id,week_start", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw insertError;

  // With ignoreDuplicates, only rows that were actually inserted come back.
  return {planned: plan.length, created: inserted?.length ?? 0};
}