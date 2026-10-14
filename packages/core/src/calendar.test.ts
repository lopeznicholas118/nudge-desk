import fc from "fast-check";
import {describe, expect, it} from "vitest";
import {extractInteractions, MAX_ATTENDEES, type CalendarEvent} from "./calendar";

const CONTACTS = new Map([
  ["ada@example.com", "contact-ada"],
  ["grace@example.com", "contact-grace"],
]);
const me = {email: "me@example.com", self: true};

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "evt-1",
  status: "confirmed",
  summary: "Coffee chat",
  start: { dateTime: "2026-10-01T15:00:00-04:00" },
  attendees: [me, {email: "Ada@Example.com"}],
  ...over,
});

describe("extractInteractions", () => {
  it("matches emails case-insensitively and normalizes the start time to UTC", () => {
    expect(extractInteractions([event()], CONTACTS).interactions).toEqual([
      {
        contactId: "contact-ada",
        externalId: "evt-1",
        occurredAt: "2026-10-01T19:00:00.000Z",
        summary: "Coffee chat",
      },
    ]);
  });

  it("creates one interaction per matched attendee", () => {
    const r = extractInteractions(
      [event({ attendees: [me, { email: "ada@example.com" }, { email: "grace@example.com" }] })],
      CONTACTS,
    );
    expect(r.interactions.map((i) => i.contactId)).toEqual(["contact-ada", "contact-grace"]);
  });

  it("reports unmatched emails, deduplicated and sorted", () => {
    const r = extractInteractions(
      [
        event({ attendees: [me, { email: "zed@example.com" }, { email: "Bob@example.com" }] }),
        event({ id: "evt-2", attendees: [me, { email: "bob@example.com" }] }),
      ],
      CONTACTS,
    );
    expect(r.unmatchedEmails).toEqual(["bob@example.com", "zed@example.com"]);
  });

  it("ignores attendees who declined and room resources", () => {
    const r = extractInteractions(
      [
        event({
          attendees: [
            me,
            {email: "ada@example.com", responseStatus: "declined"},
            {email: "grace@example.com"},
            {email: "room@resource.calendar.google.com", resource: true},
          ],
        }),
      ],
      CONTACTS,
    );
    expect(r.interactions.map((i) => i.contactId)).toEqual(["contact-grace"]);
    expect(r.unmatchedEmails).toEqual([]);
  });

  it.each([
    ["cancelled", event({ status: "cancelled" })],
    ["allDay", event({ start: { date: "2026-10-01" } })],
    ["solo", event({ attendees: [me] })],
    [
      "tooLarge",
      event({
        attendees: [me, ...Array.from({ length: MAX_ATTENDEES }, (_, i) => ({ email: `p${i}@example.com` }))],
      }),
    ],
    ["declined", event({ attendees: [{ ...me, responseStatus: "declined" }, { email: "ada@example.com" }] })],
    ["invalid", event({ start: { dateTime: "not a date" } })],
  ] as const)("skips %s events and counts them", (reason, ev) => {
    const r = extractInteractions([ev], CONTACTS);
    expect(r.interactions).toEqual([]);
    expect(r.skipped[reason]).toBe(1);
  });

  it("truncates long summaries and nulls blank ones", () => {
    const long = extractInteractions([event({ summary: "x".repeat(500) })], CONTACTS);
    expect(long.interactions[0]?.summary).toHaveLength(200);
    const blank = extractInteractions([event({ summary: "   " })], CONTACTS);
    expect(blank.interactions[0]?.summary).toBeNull();
  });
});

describe("extractInteractions properties", () => {
  const attendeeArb = fc.record({
    email: fc.constantFrom("ada@example.com", "ADA@example.com", "grace@example.com", "x@y.com", "me@example.com"),
    self: fc.boolean(),
    resource: fc.boolean(),
    responseStatus: fc.constantFrom("accepted", "declined", "needsAction"),
  });
  const eventArb = fc.record({
    id: fc.uuid(),
    status: fc.constantFrom("confirmed", "tentative", "cancelled"),
    start: fc.record({
      dateTime: fc
        .date({ min: new Date("2026-01-01"), max: new Date("2027-01-01"), noInvalidDate: true })
        .map((d) => d.toISOString()),
    }),
    attendees: fc.array(attendeeArb, { maxLength: 14 }),
  });
  const eventsArb = fc.uniqueArray(eventArb, { selector: (e) => e.id, maxLength: 20 });

  it("only emits known contacts, never duplicates one, and is deterministic", () => {
    fc.assert(
      fc.property(eventsArb, (events) => {
        const result = extractInteractions(events, CONTACTS);
        const known = new Set(CONTACTS.values());
        const keys = result.interactions.map((i) => `${i.contactId}|${i.externalId}`);
        expect(new Set(keys).size).toBe(keys.length);
        for (const i of result.interactions) expect(known.has(i.contactId)).toBe(true);
        expect(extractInteractions(events, CONTACTS)).toEqual(result);
      }),
    );
  });
});