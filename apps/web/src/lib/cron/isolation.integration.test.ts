import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import type {CalendarEvent} from "@nudge/core";
import type {Database, DbClient} from "@nudge/db";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {createSupabaseStore} from "@/lib/agent/store";
import {applyCalendarEvents} from "@/lib/google/apply";
import {generateNudgesForUser} from "./nudges";
import {processUser, type ProcessDeps} from "./process";

const DAY_MS = 86_400_000;
const NOW = new Date();
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY_MS).toISOString();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function hostnameOf(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

type Seeded = {userId: string; sharedId: string; freshId: string};

let admin: DbClient;
let A: Seeded;
let B: Seeded;
const createdUsers: string[] = [];

/** Each user gets an overdue contact sharing an email address with the other user's, plus a fresh one. */
async function seedUser(label: string): Promise<Seeded> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${label}-${randomUUID()}@example.com`,
    password: randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  const userId = data.user.id;
  createdUsers.push(userId);

  const { data: contacts, error: contactsError } = await admin
    .from("contacts")
    .insert([
      { user_id: userId, full_name: `${label} shared`, email: "shared@example.com", tier: "warm" },
      { user_id: userId, full_name: `${label} fresh`, tier: "close" },
    ])
    .select("id, full_name");
  if (contactsError || !contacts) throw contactsError ?? new Error("no contacts inserted");

  const sharedId = contacts.find((c) => c.full_name.endsWith("shared"))?.id;
  const freshId = contacts.find((c) => c.full_name.endsWith("fresh"))?.id;
  if (!sharedId || !freshId) throw new Error("seeding failed");

  const { error: interactionsError } = await admin.from("interactions").insert([
    {user_id: userId, contact_id: sharedId, kind: "meeting", occurred_at: daysFromNow(-200), source: "manual"},
    {user_id: userId, contact_id: freshId, kind: "call", occurred_at: daysFromNow(-2), source: "manual"},
  ]);
  if (interactionsError) throw interactionsError;

  return {userId, sharedId, freshId};
}

beforeAll(async () => {
  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local (run `supabase start` first).");
  }
  // These tests create and delete users with the service role. Never point them at a real project.
  if (!["127.0.0.1", "localhost"].includes(hostnameOf(url))) {
    throw new Error(`Refusing to run: ${url} is not a local Supabase instance.`);
  }

  admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  A = await seedUser("alice");
  B = await seedUser("bob");

  // Bob has an upcoming calendar meeting. An unscoped "refresh upcoming meetings" delete would wipe it.
  const { error } = await admin.from("interactions").insert({
    user_id: B.userId,
    contact_id: B.sharedId,
    kind: "meeting",
    occurred_at: daysFromNow(3),
    source: "google_calendar",
    external_id: "b-future",
  });
  if (error) throw error;
});

afterAll(async () => {
  if (!admin) return;
  // Deleting a user cascades to everything they own.
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
});

describe("calendar sync", () => {
  const events = (): CalendarEvent[] => [
    {
      id: "evt-a-1",
      status: "confirmed",
      summary: "Coffee",
      start: {dateTime: daysFromNow(2)},
      attendees: [{email: "me@example.com", self: true}, {email: "shared@example.com"}],
    },
  ];

  it("writes only to the target user and leaves other users' rows alone", async () => {
    const summary = await applyCalendarEvents(admin, A.userId, events(), NOW);
    expect(summary.interactionsUpserted).toBe(1);

    const mine = await admin
      .from("interactions")
      .select("contact_id, external_id")
      .eq("user_id", A.userId)
      .eq("source", "google_calendar");
    expect(mine.data).toEqual([{ contact_id: A.sharedId, external_id: "evt-a-1" }]);

    const theirs = await admin
      .from("interactions")
      .select("external_id")
      .eq("user_id", B.userId)
      .eq("source", "google_calendar");
    expect(theirs.data).toEqual([{ external_id: "b-future" }]);
  });

  it("is idempotent", async () => {
    await applyCalendarEvents(admin, A.userId, events(), NOW);
    await applyCalendarEvents(admin, A.userId, events(), NOW);

    const mine = await admin
      .from("interactions")
      .select("id")
      .eq("user_id", A.userId)
      .eq("source", "google_calendar");
    expect(mine.data).toHaveLength(1);
  });
});

describe("nudge generation", () => {
  it("creates this week's nudges once, only for the target user", async () => {
    expect(await generateNudgesForUser(admin, A.userId, NOW)).toEqual({ planned: 1, created: 1 });
    expect(await generateNudgesForUser(admin, A.userId, NOW)).toEqual({ planned: 1, created: 0 });

    const mine = await admin.from("nudges").select("contact_id, status, state").eq("user_id", A.userId);
    expect(mine.data).toEqual([{ contact_id: A.sharedId, status: "overdue", state: "open" }]);

    const theirs = await admin.from("nudges").select("id").eq("user_id", B.userId);
    expect(theirs.data).toEqual([]);
  });

  it("gives each user their own nudges", async () => {
    expect(await generateNudgesForUser(admin, B.userId, NOW)).toEqual({ planned: 1, created: 1 });

    const bob = await admin.from("nudges").select("contact_id").eq("user_id", B.userId);
    expect(bob.data).toEqual([{ contact_id: B.sharedId }]);

    const alice = await admin.from("nudges").select("contact_id").eq("user_id", A.userId);
    expect(alice.data).toEqual([{ contact_id: A.sharedId }]);
  });
});

describe("agent store (service role, scoped to one user)", () => {
  it("never reads or writes another user's data", async () => {
    const store = createSupabaseStore(admin, A.userId);

    const contacts = await store.listContacts();
    expect(contacts.map((c) => c.id).sort()).toEqual([A.sharedId, A.freshId].sort());

    expect(await store.getContact(B.sharedId)).toBeNull();
    expect(await store.listInteractions(B.sharedId, 10)).toEqual([]);

    const meetings = await store.listUpcomingMeetings(NOW, new Date(NOW.getTime() + 30 * DAY_MS));
    expect(meetings.map((m) => m.contactId)).not.toContain(B.sharedId);

    // Trying to draft for Bob's contact as Alice must fail on the composite foreign key.
    const result = await store.insertDraft({
      contactId: B.sharedId,
      language: "en",
      body: "Hello there, long time no talk.",
      rationale: null,
      runId: null,
    });
    expect(result).toEqual({ ok: false, reason: "unknown_contact" });

    const stolen = await admin.from("drafts").select("id").eq("contact_id", B.sharedId);
    expect(stolen.data).toEqual([]);
  });
});

describe("processUser", () => {
  it("runs the agent at most once per week per user, and another user's run doesn't count", async () => {
    const calls: string[] = [];
    const deps: ProcessDeps = {
      db: admin,
      now: NOW,
      agentEnabled: true,
      syncCalendar: async () => ({ ok: false, reason: "not_connected" }),
      runAgent: async (_db, userId) => {
        calls.push(userId);
        return {status: "completed", draftsCreated: 0};
      },
    };

    // Bob already had his weekly run. Alice has not.
    const bobRun = await admin
      .from("agent_runs")
      .insert({user_id: B.userId, triggered_by: "cron", status: "completed", model: "test", prompt_version: "test"});
    if (bobRun.error) throw bobRun.error;

    const first = await processUser(deps, A.userId);
    expect(first.agent).toBe("completed");
    expect(calls).toEqual([A.userId]);

    // Record Alice's run, then try again in the same week.
    const aliceRun = await admin
      .from("agent_runs")
      .insert({user_id: A.userId, triggered_by: "cron", status: "completed", model: "test", prompt_version: "test"});
    if (aliceRun.error) throw aliceRun.error;

    const second = await processUser(deps, A.userId);
    expect(second.agent).toBe("already_ran");
    expect(calls).toEqual([A.userId]);
  });
});