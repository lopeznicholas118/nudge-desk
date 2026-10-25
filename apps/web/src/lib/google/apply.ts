import {extractInteractions, type CalendarEvent, type ExtractionResult} from "@nudge/core";
import type {DbClient} from "@nudge/db";

const CHUNK = 500;

export type SyncSummary = {
  syncedAt: string;
  eventsScanned: number;
  interactionsUpserted: number;
  unmatchedEmails: string[];
  skipped: ExtractionResult["skipped"];
};

/**
 * Writes calendar events into `interactions` for ONE user.
 * Works with the user's own client or the service-role client. 
 * Every query filters by user_id explicitly, 
 * so correctness never depends on RLS being in force.
 */
export async function applyCalendarEvents(
  db: DbClient,
  userId: string,
  events: readonly CalendarEvent[],
  now: Date,
): Promise<SyncSummary> {
  const { data: contacts, error: contactsError } = await db
    .from("contacts")
    .select("id, email")
    .eq("user_id", userId)
    .not("email", "is", null);
  if (contactsError) throw contactsError;

  const idsByEmail = new Map<string, string>();
  for (const c of contacts ?? []) if (c.email) idsByEmail.set(c.email, c.id);

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

  // Upcoming meetings can move or be cancelled, so refresh that window wholesale: THIS user's only.
  const { error: clearError } = await db
    .from("interactions")
    .delete()
    .eq("user_id", userId)
    .eq("source", "google_calendar")
    .gt("occurred_at", now.toISOString());
  if (clearError) throw clearError;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db
      .from("interactions")
      .upsert(rows.slice(i, i + CHUNK), {onConflict: "user_id,contact_id,source,external_id"});
    if (error) throw error;
  }

  return {
    syncedAt: now.toISOString(),
    eventsScanned: events.length,
    interactionsUpserted: rows.length,
    unmatchedEmails: extracted.unmatchedEmails.slice(0, 25),
    skipped: extracted.skipped,
  };
}