import "server-only";
import type {DbClient} from "@nudge/db";
import {applyCalendarEvents, type SyncSummary} from "./apply";
import {fetchCalendarEvents} from "./calendar";
import {getAuthorizedClient, GoogleConnectionError, markNeedsReauth, recordSync} from "./connection";

export type {SyncSummary} from "./apply";

const DAY_MS = 86_400_000;
const PAST_DAYS = 180;
const FUTURE_DAYS = 30;

export type SyncOutcome =
  | { ok: true; summary: SyncSummary }
  | { ok: false; reason: "not_connected" | "needs_reauth" };

function isInvalidGrant(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error === "invalid_grant" || (e?.message ?? "").includes("invalid_grant");
}

/** Tokens come from the admin-only table; contacts and interactions go through `db`. */
export async function runCalendarSync(db: DbClient, userId: string, now: Date): Promise<SyncOutcome> {
  let oauth;
  try {
    oauth = await getAuthorizedClient(userId);
  } catch (err) {
    if (err instanceof GoogleConnectionError) return { ok: false, reason: err.reason };
    throw err;
  }

  let events;
  try {
    events = await fetchCalendarEvents(oauth, {
      timeMin: new Date(now.getTime() - PAST_DAYS * DAY_MS),
      timeMax: new Date(now.getTime() + FUTURE_DAYS * DAY_MS),
    });
  } catch (err) {
    if (isInvalidGrant(err)) {
      await markNeedsReauth(userId);
      return {ok: false, reason: "needs_reauth"};
    }
    throw err;
  }

  const summary = await applyCalendarEvents(db, userId, events, now);
  await recordSync(userId, summary);
  return {ok: true, summary};
}