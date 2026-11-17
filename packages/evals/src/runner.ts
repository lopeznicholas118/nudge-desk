import {runAgent, type AgentResult, type LlmClient} from "@nudge/agent";
import {gradeTrial, softMetrics} from "./graders";
import {judgeDraft, type JudgeVerdict} from "./judge";
import type {DraftResult, TrialResult} from "./report";
import type {EvalCase} from "./types";

/** The get_contact_context output the model saw for this contact, which is what the judge grades against. */
function contextFor(result: AgentResult, contactId: string): string {
  for (const s of result.steps) {
    if (s.type === "tool" && s.name === "get_contact_context" && !s.isError) {
      const input = s.input as {contact_id?: unknown} | null;
      if (input?.contact_id === contactId) return s.output;
    }
  }
  return "(the assistant never looked up this contact, so anything specific in the draft is unsupported)";
}

export async function runTrial(
  c: EvalCase,
  trial: number,
  agent: LlmClient,
  judge: LlmClient | null,
): Promise<TrialResult> {
  const started = performance.now();
  const store = await c.build();
  const result = await runAgent({
    llm: agent,
    store,
    now: c.now,
    request: c.request,
    voiceSamples: c.voiceSamples,
    maxDrafts: c.maxDrafts,
  });

  // Only drafts created during this run (a case may pre-seed some).
  const made = store.drafts.filter((d) => result.draftIds.includes(d.id));
  const contacts = new Map(
    (await store.listContacts()).map((x) => [x.id, { name: x.fullName, preferredLanguage: x.preferredLanguage }] as const),
  );
  const knownText = [
    ...result.steps.flatMap((s) => (s.type === "tool" ? [s.output] : [])),
    ...(c.voiceSamples ?? []),
  ].join("\n");

  const checks = gradeTrial({ expect: c.expect, result, drafts: made, contacts, knownText });
  const soft = softMetrics(made, result, knownText);

  const drafts: DraftResult[] = [];
  for (const d of made) {
    const info = contacts.get(d.contactId);
    let verdict: JudgeVerdict | null = null;
    let judgeError: string | null = null;
    if (judge) {
      const outcome = await judgeDraft(judge, {
        body: d.body,
        expectedLanguage: info?.preferredLanguage ?? d.language,
        context: contextFor(result, d.contactId),
        voiceSamples: c.voiceSamples ?? [],
      });
      if (outcome.ok) verdict = outcome.verdict;
      else judgeError = outcome.error;
    }
    drafts.push({
      contactId: d.contactId,
      contactName: info?.name ?? d.contactId,
      language: d.language,
      body: d.body,
      verdict,
      judgeError,
    });
  }

  return {
    caseId: c.id,
    trial,
    passed: checks.every((k) => k.passed),
    checks,
    status: result.status,
    llmCalls: soft.llmCalls,
    toolErrors: soft.toolErrors,
    ungroundedNumbers: soft.ungroundedNumbers,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    formatOkRate: soft.formatOkRate,
    drafts,
    finalText: result.finalText,
    error: result.error,
    durationMs: Math.round(performance.now() - started),
  };
}

function crashedTrial(c: EvalCase, trial: number, err: unknown): TrialResult {
  const message = err instanceof Error ? err.message : "unknown error";
  return {
    caseId: c.id,
    trial,
    passed: false,
    checks: [{ name: "harness_error", passed: false, detail: message }],
    status: "error",
    llmCalls: 0,
    toolErrors: 0,
    ungroundedNumbers: 0,
    inputTokens: 0,
    outputTokens: 0,
    formatOkRate: null,
    drafts: [],
    finalText: "",
    error: message,
    durationMs: 0,
  };
}

export type SuiteOptions = {
  cases: readonly EvalCase[];
  trials: number;
  agent: LlmClient;
  judge: LlmClient | null;
  concurrency?: number;
  onTrial?: (t: TrialResult) => void;
};

/** Runs every (case, trial) pair with a small worker pool. Results keep their original order. */
export async function runSuite(opts: SuiteOptions): Promise<TrialResult[]> {
  const jobs = opts.cases.flatMap((c) => Array.from({ length: opts.trials }, (_, i) => ({ c, trial: i + 1 })));
  const results: TrialResult[] = [];
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      const job = jobs[index];
      if (!job) return;
      let result: TrialResult;
      try {
        result = await runTrial(job.c, job.trial, opts.agent, opts.judge);
      } catch (err) {
        result = crashedTrial(job.c, job.trial, err);
      }
      results[index] = result;
      opts.onTrial?.(result);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 2) }, worker));
  return results;
}