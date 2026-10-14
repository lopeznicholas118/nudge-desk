import {redirect} from "next/navigation";
import {getConnectionStatus} from "@/lib/google/connection";
import type {SyncSummary} from "@/lib/google/sync";
import {createClient} from "@/lib/supabase/server";
import {signOut} from "../login/actions";
import {addContact, disconnectGoogle, syncCalendar} from "./actions";

const MESSAGES: Record<string, string> = {
  "google:connected": "Google Calendar connected.",
  "google:denied": "Google connection was cancelled.",
  "google:missing_scope": "Calendar access wasn't granted. Reconnect and tick the calendar permission.",
  "google:state_mismatch": "That connection attempt expired. Please try again.",
  "google:error": "Something went wrong connecting Google. Please try again.",
  "sync:failed": "Sync failed. Check the server logs.",
  "sync:needs_reauth": "Google access expired. Please reconnect.",
  "sync:not_connected": "Connect Google Calendar first.",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [connection, contacts] = await Promise.all([
    getConnectionStatus(user.id),
    supabase
      .from("contacts_with_last_interaction")
      .select("id, full_name, email, tier, last_interaction_at")
      .order("full_name"),
  ]);

  const banner =
    params.error ?? MESSAGES[`google:${params.google}`] ?? MESSAGES[`sync:${params.sync}`];
  const summary = connection?.last_sync_summary as SyncSummary | null;
  const input = "rounded border border-gray-300 px-3 py-2 text-white";
  const button = "rounded border border-gray-400 px-3 py-2";

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-500">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button className={button}>Sign out</button>
        </form>
      </header>

      {banner && <p role="status" className="rounded bg-blue-100 p-3 text-blue-900">{banner}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        {!connection && <a href="/api/google/connect" className={`${button} inline-block`}>Connect Google Calendar</a>}
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
              <form action={syncCalendar}><button className={button}>Sync now</button></form>
              <form action={disconnectGoogle}><button className={button}>Disconnect</button></form>
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
        <h2 className="text-lg font-semibold">Add a contact</h2>
        <form action={addContact} className="flex flex-wrap gap-2">
          <input className={input} name="full_name" placeholder="Full name" required />
          <input className={input} name="email" type="email" placeholder="Email (matches calendar)" />
          <select className={input} name="tier" defaultValue="warm">
            <option value="close">close</option>
            <option value="warm">warm</option>
            <option value="weak">weak</option>
          </select>
          <button className={button}>Add</button>
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