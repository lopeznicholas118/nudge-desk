import {NextResponse} from "next/server";
import {runAgentForUser} from "@/lib/agent/run";
import {isAuthorizedCron} from "@/lib/cron/auth";
import {processUser, type ProcessDeps} from "@/lib/cron/process";
import {describeError} from "@/lib/errors";
import {runCalendarSync} from "@/lib/google/sync";
import {createAdminClient} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY_MS = 86_400_000;
// Stop STARTING new users after this long, leaving room for the one in flight to finish.
const TIME_BUDGET_MS = 25_000;

function tally(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = Date.now();
  const now = new Date();
  const db = createAdminClient();

  const {data, error} = await db.rpc("users_with_contacts");
  if (error) {
    console.error("cron: listing users failed:", describeError(error));
    return NextResponse.json({ ok: false, error: "list_users_failed" }, { status: 500 });
  }

  // Stable order, rotated daily so a time-boxed run doesn't always favor the same users.
  const all = (data ?? []).map((r) => r.user_id).sort();
  const offset = all.length === 0 ? 0 : Math.floor(now.getTime() / DAY_MS) % all.length;
  const queue = [...all.slice(offset), ...all.slice(0, offset)];

  const deps: ProcessDeps = {
    db,
    now,
    agentEnabled: process.env.CRON_AGENT_ENABLED !== "false",
    syncCalendar: runCalendarSync,
    runAgent: async (client, userId) => {
      const {result} = await runAgentForUser(client, userId, "cron");
      return {status: result.status, draftsCreated: result.draftIds.length};
    },
  };

  const sync: Record<string, number> = {};
  const agent: Record<string, number> = {};
  let processed = 0;
  let failed = 0;
  let nudgesCreated = 0;
  let draftsCreated = 0;

  for (const userId of queue) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;
    try {
      const outcome = await processUser(deps, userId);
      nudgesCreated += outcome.nudgesCreated;
      draftsCreated += outcome.draftsCreated;
      tally(sync, outcome.sync);
      tally(agent, outcome.agent);
    } catch (err) {
      failed++;
      console.error("cron: user failed:", userId, describeError(err));
    }
  }

  return NextResponse.json({
    ok: true,
    usersTotal: all.length,
    processed,
    failed,
    nudgesCreated,
    draftsCreated,
    sync,
    agent,
    durationMs: Date.now() - started,
  });
}