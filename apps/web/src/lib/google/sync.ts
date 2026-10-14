import "server-only";
import {extractInteractions, type ExtractionResult} from "@nudge/core";
import type {createClient} from "@/lib/supabase/server";
import {fetchCalendarEvents} from "./calendar";
import {getAuthorizedClient, GoogleConnectionError, markNeedsReauth, recordSync} from "./connection";

type UserClient = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 86_400_000;
const PAST_DAYS = 180;
const FUTURE_DAYS = 30;
const CHUNK = 500;

export type SyncSummary = {
  syncedAt: string;
  eventsScanned: number;
  interactionsUpserted: number;
  unmatchedEmails: string[];
  skipped: ExtractionResult["skipped"];
}

export type SyncOutcome =
  | { ok: true; summary: SyncSummary }
  | { ok: false; reason: "not_connected" | "needs_reauth" };

function isInvalidGrant(err: unknown): boolean {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error === "invalid_grant" || (e?.message ?? "").includes("invalid_grant");
}

/**
 * Reads tokens with the admin client, but reads/writes contacts and interactions
 * with the USER's client, so RLS still guards the data.
 */
export async function runCalendarSync(supabase: UserClient, userId: string, now: Date): Promise<SyncOutcome> {
  let oauth;
  try {
    oauth = await getAuthorizedClient(userId);
  } catch (err) {
    if (err instanceof GoogleConnectionError) return { ok: false, reason: err.reason };
    throw err;
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, email")
    .not("email", "is", null);
  if (contactsError) throw contactsError;

  const idsByEmail = new Map<string, string>();
  for (const c of contacts ?? []) if (c.email) idsByEmail.set(c.email, c.id);

  let events;
  try {
    events = await fetchCalendarEvents(oauth, {
      timeMin: new Date(now.getTime() - PAST_DAYS * DAY_MS),
      timeMax: new Date(now.getTime() + FUTURE_DAYS * DAY_MS),
    });
  } catch (err) {
    if (isInvalidGrant(err)) {
      await markNeedsReauth(userId);
      return { ok: false, reason: "needs_reauth" };
    }
    throw err;
  }

  const extracted = extractInteractions(events, idsByEmail);
  const rows = extracted.interactions.map((i) => ({
    user_id: userId,
    contact_id: i.contactId,
    kind: "meeting" as const,
    occurred_at: i.occurredAt,
    source: "google_calendar" as const,
    external_id: i.externalId,
    summary: i.summary,
  }));

  // Upcoming meetings can be moved or cancelled, so refresh that window wholesale.
  const { error: clearError } = await supabase
    .from("interactions")
    .delete()
    .eq("source", "google_calendar")
    .gt("occurred_at", now.toISOString());
  if (clearError) throw clearError;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("interactions")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,contact_id,source,external_id" });
    if (error) throw error;
  }

  const summary: SyncSummary = {
    syncedAt: now.toISOString(),
    eventsScanned: events.length,
    interactionsUpserted: rows.length,
    unmatchedEmails: extracted.unmatchedEmails.slice(0, 25),
    skipped: extracted.skipped,
  };
  await recordSync(userId, summary);
  return {ok: true, summary};
}