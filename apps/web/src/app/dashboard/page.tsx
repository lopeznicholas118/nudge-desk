import {weekStart} from "@nudge/core";
import {requireUser} from "@/lib/auth";
import {getConnectionStatus} from "@/lib/google/connection";
import type {SyncSummary} from "@/lib/google/sync";
import {signOut} from "../login/actions";
import {addContact, disconnectGoogle, runAgentNow, syncCalendar } from "./actions";
import {ApprovedCard} from "./_components/approved-card";
import {DraftCard} from "./_components/draft-card";
import {NudgeList, type NudgeView} from "./_components/nudge-list";
import {ui} from "./_components/ui";

export const maxDuration = 60;

const MESSAGES: Record<string, string> = {
  "google:connected": "Google Calendar connected.",
  "google:denied": "Google connection was cancelled.",
  "google:missing_scope": "Calendar access wasn't granted. Reconnect and tick the calendar permission.",
  "google:state_mismatch": "That connection attempt expired. Please try again.",
  "google:error": "Something went wrong connecting Google. Please try again.",
  "sync:failed": "Sync failed. Check the server logs.",
  "sync:needs_reauth": "Google access expired. Please reconnect.",
  "sync:not_connected": "Connect Google Calendar first.",
  "flash:draft_saved": "Draft saved.",
  "flash:draft_translated": "Translated. Use the toggle to switch back without translating again.",
  "flash:draft_approved": "Approved. Copy it or open it in your email app, then press “I sent it”.",
  "flash:draft_discarded": "Draft discarded.",
  "flash:draft_sent": "Marked as sent. That contact is now caught up.",
  "flash:draft_missing": "That draft is no longer waiting for you.",
  "flash:draft_invalid": "Drafts need between 10 and 2000 characters.",
  "flash:nudge_dismissed": "Nudge dismissed.",
  "flash:nudge_missing": "That nudge is no longer open.",
  "flash:failed": "Something went wrong. Check the server logs.",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const {supabase, user} = await requireUser();

  const [connection, contacts, drafts, nudges] = await Promise.all([
    getConnectionStatus(user.id),
    supabase
      .from("contacts_with_last_interaction")
      .select("id, full_name, email, tier, last_interaction_at")
      .order("full_name"),
    supabase
      .from("drafts")
      .select("id, contact_id, status, language, alt_language, body, rationale")
      .in("status", ["pending", "approved"])
      .order("created_at", {ascending: false}),
    supabase
      .from("nudges")
      .select("id, contact_id, reason")
      .eq("state", "open")
      .eq("week_start", weekStart(new Date()))
      .order("score", {ascending: false}),
  ]);

  const contactsById = new Map((contacts.data ?? []).map((c) => [c.id, c]));
  const pending = (drafts.data ?? []).filter((d) => d.status === "pending");
  const approved = (drafts.data ?? []).filter((d) => d.status === "approved");
  const withOpenDraft = new Set((drafts.data ?? []).map((d) => d.contact_id));

  const nudgeViews: NudgeView[] = (nudges.data ?? []).map((n) => {
    const c = contactsById.get(n.contact_id);
    return {
      id: n.id,
      name: c?.full_name ?? "Unknown",
      tier: c?.tier ?? "",
      reason: n.reason,
      hasDraft: withOpenDraft.has(n.contact_id),
    };
  });

  const agentBanner =
    params.agent === "completed"
      ? `Agent finished: ${params.drafts ?? 0} draft(s) ready for review.`
      : params.agent === "failed"
        ? "The agent run failed. Check the server logs."
        : params.agent
          ? `Agent stopped early (${params.agent}). Partial results may be saved.`
          : undefined;

  const banner =
    params.error ??
    MESSAGES[`google:${params.google}`] ??
    MESSAGES[`sync:${params.sync}`] ??
    MESSAGES[`flash:${params.flash}`] ??
    agentBanner;
  const summary = connection?.last_sync_summary as SyncSummary | null;

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button className={ui.button}>Sign out</button>
        </form>
      </header>

      {banner && <p role="status" className="rounded bg-blue-100 p-3 text-blue-900">{banner}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        {!connection && <a href="/api/google/connect" className={`${ui.button} inline-block`}>Connect Google Calendar</a>}
        {connection?.status === "needs_reauth" && (
          <p>
            Access expired. <a className="underline" href="/api/google/connect">Reconnect</a>
          </p>
        )}
        {connection?.status === "active" && (
          <>
            <p>
              Connected as <strong>{connection.google_email}</strong>
              {connection.last_synced_at && ` · last synced ${new Date(connection.last_synced_at).toLocaleString("en-US")}`}
            </p>
            <div className="flex gap-3">
              <form action={syncCalendar}><button className={ui.button}>Sync now</button></form>
              <form action={disconnectGoogle}><button className={ui.button}>Disconnect</button></form>
            </div>
          </>
        )}
        {summary && (
          <div className="rounded bg-gray-100 p-3 text-sm text-black">
            <p>
              Scanned {summary.eventsScanned} events · recorded {summary.interactionsUpserted} meetings with your contacts
            </p>
            <p>Skipped: {Object.entries(summary.skipped).map(([k, v]) => `${k} ${v}`).join(", ")}</p>
            {summary.unmatchedEmails.length > 0 && (
              <p>Not in your contacts yet: {summary.unmatchedEmails.join(", ")}</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Agent</h2>
        <form action={runAgentNow}>
          <button className={ui.button}>Run agent</button>
        </form>
        <p className="text-sm text-gray-500">
          Drafts the people you&apos;re most overdue to contact. Nothing is ever sent.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">This week&apos;s nudges</h2>
        <NudgeList nudges={nudgeViews} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Drafts to review</h2>
        {pending.length === 0 && <p className="text-gray-500">No drafts waiting for review.</p>}
        <ul className="space-y-3">
          {pending.map((d) => (
            <DraftCard key={d.id} draft={d} contactName={contactsById.get(d.contact_id)?.full_name ?? "Unknown"} />
          ))}
        </ul>
      </section>

      {approved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ready to send</h2>
          <p className="text-sm text-gray-500">
            Nudge Desk never sends for you. Send these yourself, then press &ldquo;I sent it&rdquo;.
          </p>
          <ul className="space-y-3">
            {approved.map((d) => {
              const c = contactsById.get(d.contact_id);
              return (
                <ApprovedCard
                  key={d.id}
                  draft={d}
                  contactName={c?.full_name ?? "Unknown"}
                  contactEmail={c?.email ?? null}
                />
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add a contact</h2>
        <form action={addContact} className="flex flex-wrap gap-2">
          <input className={`${ui.input} text-gray-400`} name="full_name" placeholder="Full name" required />
          <input className={`${ui.input} text-gray-400`} name="email" type="email" placeholder="Email (matches calendar)" />
          <select className={`${ui.input} text-gray-400`} name="tier" defaultValue="warm">
            <option value="close">close</option>
            <option value="warm">warm</option>
            <option value="weak">weak</option>
          </select>
          <button className={ui.button}>Add</button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {contacts.data?.length === 0 && <p className="text-gray-500">No contacts yet.</p>}
        <ul className="divide-y">
          {contacts.data?.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {c.full_name} <span className="text-gray-500">({c.tier}) {c.email}</span>
              </span>
              <span className="text-sm text-gray-500">
                {c.last_interaction_at
                  ? `last contact ${new Date(c.last_interaction_at).toLocaleDateString("en-US")}`
                  : "no contact logged"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}