/** Minimal shapes of what we read from the Google Calendar API. */
export interface CalendarAttendee {
  email?: string;
  self?: boolean;
  resource?: boolean;
  responseStatus?: string;
}

export interface CalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: CalendarAttendee[];
}

export interface ExtractedInteraction {
  contactId: string;
  externalId: string;
  occurredAt: string; // UTC ISO string
  summary: string | null;
}

export type SkipCounts = {
  cancelled: number;
  allDay: number;
  solo: number;
  tooLarge: number;
  declined: number;
  invalid: number;
}

export interface ExtractionResult {
  interactions: ExtractedInteraction[];
  unmatchedEmails: string[];
  skipped: SkipCounts;
}

/** Bigger meetings (all-hands, webinars) say little about a relationship. */
export const MAX_ATTENDEES = 10;
const SUMMARY_MAX = 200;

function cleanSummary(summary: string | undefined): string | null {
  const trimmed = (summary ?? "").trim().slice(0, SUMMARY_MAX);
  return trimmed === "" ? null : trimmed;
}

/**
 * Turns calendar events into interactions with known contacts.
 * `contactIdsByEmail` keys must be lowercase.
 * Event summaries are untrusted input (anyone can invite you to an event titled
 * anything), so they're truncated here and must be treated as data, never instructions.
 */
export function extractInteractions(
  events: readonly CalendarEvent[],
  contactIdsByEmail: ReadonlyMap<string, string>,
): ExtractionResult {
  const skipped: SkipCounts = { cancelled: 0, allDay: 0, solo: 0, tooLarge: 0, declined: 0, invalid: 0 };
  const interactions: ExtractedInteraction[] = [];
  const unmatched = new Set<string>();

  for (const event of events) {
    if (!event.id) { skipped.invalid++; continue; }
    if (event.status === "cancelled") { skipped.cancelled++; continue; }

    const startRaw = event.start?.dateTime;
    if (!startRaw) {
      if (event.start?.date) skipped.allDay++;
      else skipped.invalid++;
      continue;
    }
    const occurred = new Date(startRaw);
    if (Number.isNaN(occurred.getTime())) { skipped.invalid++; continue; }

    const attendees = event.attendees ?? [];
    if (attendees.length < 2) { skipped.solo++; continue; }
    if (attendees.length > MAX_ATTENDEES) { skipped.tooLarge++; continue; }
    if (attendees.some((a) => a.self && a.responseStatus === "declined")) { skipped.declined++; continue; }

    const seen = new Set<string>();
    for (const attendee of attendees) {
      if (attendee.self || attendee.resource || !attendee.email) continue;
      if (attendee.responseStatus === "declined") continue;

      const email = attendee.email.trim().toLowerCase();
      const contactId = contactIdsByEmail.get(email);
      if (!contactId) { unmatched.add(email); continue; }
      if (seen.has(contactId)) continue;
      seen.add(contactId);

      interactions.push({
        contactId,
        externalId: event.id,
        occurredAt: occurred.toISOString(),
        summary: cleanSummary(event.summary),
      });
    }
  }

  return { interactions, unmatchedEmails: [...unmatched].sort(), skipped };
}