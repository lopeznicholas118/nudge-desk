import {weekStart} from "@nudge/core";
import type {DbClient} from "@nudge/db";
import {describeError} from "@/lib/errors";
import {generateNudgesForUser} from "./nudges";

export type AgentRunStatus = "completed" | "max_steps" | "max_tokens" | "error";

export type UserOutcome = {
  sync: "ok" | "not_connected" | "needs_reauth" | "failed";
  nudgesCreated: number;
  agent: AgentRunStatus | "disabled" | "no_nudges" | "already_ran" | "failed";
  draftsCreated: number;
};

/** Google and Anthropic are injected, so the database logic is testable on its own. */
export type ProcessDeps = {
  db: DbClient;
  now: Date;
  agentEnabled: boolean;
  syncCalendar: (
    db: DbClient,
    userId: string,
    now: Date,
  ) => Promise<{ok: true} | {ok: false; reason: "not_connected" | "needs_reauth"}>;
  runAgent: (db: DbClient, userId: string) => Promise<{ status: AgentRunStatus; draftsCreated: number }>;
};

/** True if this user already had a finished cron-triggered agent run in the current ISO week. */
async function hasAgentRunThisWeek(db: DbClient, userId: string, now: Date): Promise<boolean> {
  const {count, error} = await db
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("triggered_by", "cron")
    .in("status", ["completed", "max_steps", "max_tokens"]) // failed or crashed runs get retried
    .gte("created_at", `${weekStart(now)}T00:00:00Z`);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function processUser(deps: ProcessDeps, userId: string): Promise<UserOutcome> {
  const {db, now} = deps;

  // 1. Refresh calendar data. A failure here must not block nudges.
  let sync: UserOutcome["sync"];
  try {
    const result = await deps.syncCalendar(db, userId, now);
    sync = result.ok ? "ok" : result.reason;
  } catch (err) {
    console.error("cron: calendar sync failed for", userId, describeError(err));
    sync = "failed";
  }

  // 2. Deterministic and free: this week's nudges.
  const nudges = await generateNudgesForUser(db, userId, now);
  const outcome: UserOutcome = { sync, nudgesCreated: nudges.created, agent: "disabled", draftsCreated: 0 };

  // 3. The paid part: at most one agent run per week, and only when there is something to nudge.
  if (!deps.agentEnabled) return outcome;
  if (nudges.planned === 0) return {...outcome, agent: "no_nudges"};
  if (await hasAgentRunThisWeek(db, userId, now)) return {...outcome, agent: "already_ran"};

  try {
    const run = await deps.runAgent(db, userId);
    return {...outcome, agent: run.status, draftsCreated: run.draftsCreated};
  } catch (err) {
    console.error("cron: agent run failed for", userId, describeError(err));
    return {...outcome, agent: "failed"};
  }
}