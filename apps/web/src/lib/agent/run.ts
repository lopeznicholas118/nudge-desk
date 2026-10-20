import "server-only";
import {createAnthropicLlm, PROMPT_VERSION, runAgent, type AgentResult, type TraceStep} from "@nudge/agent";
import type {Json} from "@nudge/db";
import {anthropicEnv} from "@/lib/env.server";
import {describeError} from "@/lib/errors";
import type {createClient} from "@/lib/supabase/server";
import {createSupabaseStore} from "./store";

type UserClient = Awaited<ReturnType<typeof createClient>>;

const MAX_STORED_CHARS = 4000;
const clip = (text: string) => (text.length > MAX_STORED_CHARS ? text.slice(0, MAX_STORED_CHARS) + "…" : text);

function toStepRow(runId: string, userId: string, s: TraceStep) {
  const base = { run_id: runId, user_id: userId, step_index: s.index, latency_ms: Math.round(s.latencyMs) };
  if (s.type === "llm") {
    return {
      ...base,
      kind: "llm" as const,
      output: clip(s.text),
      stop_reason: s.stopReason,
      input_tokens: s.inputTokens,
      output_tokens: s.outputTokens,
    };
  }
  return {
    ...base,
    kind: "tool" as const,
    tool_name: s.name,
    input: s.input as Json,
    output: clip(s.output),
    error: s.internalError ? clip(s.internalError) : null,
    is_error: s.isError,
  };
}

export async function runAgentForUser(
  supabase: UserClient,
  userId: string,
  triggeredBy: "manual" | "cron",
): Promise<{ runId: string; result: AgentResult }> {
  const env = anthropicEnv();
  const llm = createAnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });

  // Create the run row first so even a crash leaves evidence (status stays 'running').
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .insert({ user_id: userId, triggered_by: triggeredBy, model: llm.model, prompt_version: PROMPT_VERSION })
    .select("id")
    .single();
  if (runError) throw runError;

  const result = await runAgent({
    llm,
    store: createSupabaseStore(supabase, userId),
    now: new Date(),
    runId: run.id,
  });

  // Persisting the trace must never hide the result, so log failures instead of throwing.
  if (result.steps.length > 0) {
    const {error} = await supabase
      .from("agent_steps")
      .insert(result.steps.map((s) => toStepRow(run.id, userId, s)));
    if (error) console.error("saving agent steps failed:", describeError(error));
  }

  const {error: updateError} = await supabase
    .from("agent_runs")
    .update({
      status: result.status,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      drafts_created: result.draftIds.length,
      final_text: result.finalText || null,
      error: result.error,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("user_id", userId);
  if (updateError) console.error("updating agent run failed:", describeError(updateError));

  return {runId: run.id, result};
}