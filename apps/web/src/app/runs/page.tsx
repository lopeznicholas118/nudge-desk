import Link from "next/link";
import {requireUser} from "@/lib/auth";

export default async function RunsPage() {
  const {supabase, user} = await requireUser();
  const {data: runs} = await supabase
    .from("agent_runs")
    .select("id, created_at, triggered_by, status, model, prompt_version, drafts_created, input_tokens, output_tokens")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <Link href="/dashboard" className="text-sm underline">← Dashboard</Link>
      <h1 className="text-xl font-semibold">Agent runs</h1>
      {runs?.length === 0 && <p className="text-gray-500">No runs yet.</p>}
      <ul className="divide-y">
        {runs?.map((r) => (
          <li key={r.id} className="py-2 text-sm">
            <Link href={`/runs/${r.id}`} className="underline">{new Date(r.created_at).toLocaleString("en-US")}</Link>{" "}
            · {r.status} · {r.triggered_by} · prompt {r.prompt_version} · {r.drafts_created} drafts ·{" "}
            {r.input_tokens + r.output_tokens} tokens
          </li>
        ))}
      </ul>
    </main>
  );
}