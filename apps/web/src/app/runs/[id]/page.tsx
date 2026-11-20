import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireUser} from "@/lib/auth";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const {supabase, user} = await requireUser();

  const {data: run} = await supabase
    .from("agent_runs")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", id.data)
    .maybeSingle();
  if (!run) notFound();

  const {data: steps} = await supabase
    .from("agent_steps")
    .select("step_index, kind, tool_name, is_error, error, stop_reason, latency_ms, input_tokens, output_tokens, input, output")
    .eq("user_id", user.id)
    .eq("run_id", run.id)
    .order("step_index");

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <Link href="/runs" className="text-sm underline">← All runs</Link>
      <h1 className="text-xl font-semibold">Run {run.id.slice(0, 8)}</h1>
      <p className="text-sm text-gray-500">
        {run.status} · {run.triggered_by} · {run.model} · prompt {run.prompt_version} · {run.drafts_created} drafts
      </p>
      {run.error && <p className="rounded bg-red-100 p-3 text-red-800">{run.error}</p>}
      <ol className="space-y-2">
        {steps?.map((s) => (
          <li key={s.step_index} className="rounded border border-gray-300 p-3 text-sm">
            <p className="font-semibold">
              #{s.step_index} {s.kind === "tool" ? s.tool_name : "model call"}
              {s.is_error ? " (error)" : ""}
              <span className="font-normal text-gray-500">
                {" "}· {s.latency_ms} ms
                {s.kind === "llm" ? ` · ${s.input_tokens}/${s.output_tokens} tokens · ${s.stop_reason}` : ""}
              </span>
            </p>
            {s.input !== null && (
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(s.input).slice(0, 400)}</pre>
            )}
            {s.output && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{s.output.slice(0, 600)}</pre>}
            {s.error && <pre className="mt-1 whitespace-pre-wrap text-xs text-red-700">{s.error}</pre>}
          </li>
        ))}
      </ol>
    </main>
  );
}