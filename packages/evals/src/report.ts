import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {PROMPT_VERSION, type RunStatus} from "@nudge/agent";
import type {Language} from "@nudge/core";
import type {JudgeVerdict} from "./judge";
import type {Check, EvalCase} from "./types";

export type DraftResult = {
  contactId: string;
  contactName: string;
  language: Language;
  body: string;
  verdict: JudgeVerdict | null;
  judgeError: string | null;
};

export type TrialResult = {
  caseId: string;
  trial: number;
  passed: boolean;
  checks: Check[];
  status: RunStatus;
  llmCalls: number;
  toolErrors: number;
  ungroundedNumbers: number;
  inputTokens: number;
  outputTokens: number;
  formatOkRate: number | null;
  drafts: DraftResult[];
  finalText: string;
  error: string | null;
  durationMs: number;
};

export type JudgeSummary = {
  drafts: number;
  errors: number;
  acceptRate: number;
  warmth: number;
  specificity: number;
  easyToReply: number;
  voiceMatch: number | null;
};

export type CaseReport = {
  caseId: string;
  description: string;
  security: boolean;
  trials: number;
  passRate: number;
  failedChecks: Record<string, number>;
  formatOkRate: number | null;
  judge: JudgeSummary | null;
  avgLlmCalls: number;
  avgToolErrors: number;
  avgInputTokens: number;
  avgOutputTokens: number;
};

export type RunReport = {
  schemaVersion: 1;
  label: string;
  createdAt: string;
  gitSha: string | null;
  agentModel: string;
  judgeModel: string | null;
  promptVersion: string;
  trialsPerCase: number;
  overall: {
    totalTrials: number;
    passRate: number;
    securityPassRate: number | null;
    formatOkRate: number | null;
    judge: JudgeSummary | null;
    avgLlmCalls: number;
    avgToolErrors: number;
    avgInputTokens: number;
    avgOutputTokens: number;
  };
  cases: CaseReport[];
  trials: TrialResult[];
};

const avg = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const avgOrNull = (xs: readonly number[]) => (xs.length === 0 ? null : avg(xs));
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r3OrNull = (n: number | null) => (n === null ? null : r3(n));
const passedNumber = (t: TrialResult) => (t.passed ? 1 : 0);
const formatRates = (trials: readonly TrialResult[]) =>
  trials.flatMap((t) => (t.formatOkRate === null ? [] : [t.formatOkRate]));

export function summarizeJudge(trials: readonly TrialResult[]): JudgeSummary | null {
  const drafts = trials.flatMap((t) => t.drafts);
  const errors = drafts.filter((d) => d.judgeError !== null).length;
  const verdicts = drafts.flatMap((d) => (d.verdict ? [d.verdict] : []));
  if (verdicts.length === 0 && errors === 0) return null;
  const voice = verdicts.flatMap((v) => (v.voice_match === null ? [] : [v.voice_match]));
  return {
    drafts: verdicts.length,
    errors,
    acceptRate: r3(avg(verdicts.map((v) => (v.acceptable ? 1 : 0)))),
    warmth: r3(avg(verdicts.map((v) => v.warmth))),
    specificity: r3(avg(verdicts.map((v) => v.specificity))),
    easyToReply: r3(avg(verdicts.map((v) => v.easy_to_reply))),
    voiceMatch: voice.length === 0 ? null : r3(avg(voice)),
  };
}

export type ReportMeta = {
  label: string;
  gitSha: string | null;
  agentModel: string;
  judgeModel: string | null;
  trialsPerCase: number;
};

export function buildReport(meta: ReportMeta, cases: readonly EvalCase[], trials: readonly TrialResult[]): RunReport {
  const reportCase = (c: EvalCase): CaseReport => {
    const mine = trials.filter((t) => t.caseId === c.id);
    const failedChecks: Record<string, number> = {};
    for (const t of mine) for (const k of t.checks) if (!k.passed) failedChecks[k.name] = (failedChecks[k.name] ?? 0) + 1;
    return {
      caseId: c.id,
      description: c.description,
      security: c.security === true,
      trials: mine.length,
      passRate: r3(avg(mine.map(passedNumber))),
      failedChecks,
      formatOkRate: r3OrNull(avgOrNull(formatRates(mine))),
      judge: summarizeJudge(mine),
      avgLlmCalls: r3(avg(mine.map((t) => t.llmCalls))),
      avgToolErrors: r3(avg(mine.map((t) => t.toolErrors))),
      avgInputTokens: Math.round(avg(mine.map((t) => t.inputTokens))),
      avgOutputTokens: Math.round(avg(mine.map((t) => t.outputTokens))),
    };
  };

  const securityIds = new Set(cases.filter((c) => c.security).map((c) => c.id));
  const security = trials.filter((t) => securityIds.has(t.caseId));

  return {
    schemaVersion: 1,
    label: meta.label,
    createdAt: new Date().toISOString(),
    gitSha: meta.gitSha,
    agentModel: meta.agentModel,
    judgeModel: meta.judgeModel,
    promptVersion: PROMPT_VERSION,
    trialsPerCase: meta.trialsPerCase,
    overall: {
      totalTrials: trials.length,
      passRate: r3(avg(trials.map(passedNumber))),
      securityPassRate: security.length === 0 ? null : r3(avg(security.map(passedNumber))),
      formatOkRate: r3OrNull(avgOrNull(formatRates(trials))),
      judge: summarizeJudge(trials),
      avgLlmCalls: r3(avg(trials.map((t) => t.llmCalls))),
      avgToolErrors: r3(avg(trials.map((t) => t.toolErrors))),
      avgInputTokens: Math.round(avg(trials.map((t) => t.inputTokens))),
      avgOutputTokens: Math.round(avg(trials.map((t) => t.outputTokens))),
    },
    cases: cases.map(reportCase),
    trials: [...trials],
  };
}

const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`);
const kTokens = (n: number) => `${(n / 1000).toFixed(1)}k`;

export function formatReport(r: RunReport): string {
  const lines = [
    `Eval "${r.label}"  agent=${r.agentModel}  judge=${r.judgeModel ?? "off"}  prompt=${r.promptVersion}  trials/case=${r.trialsPerCase}`,
    "",
    `${"case".padEnd(30)}${"pass".padStart(7)}${"format".padStart(8)}${"judge ok".padStart(10)}${"calls".padStart(7)}${"tokens".padStart(9)}`,
  ];
  for (const c of r.cases) {
    const label = `${c.caseId}${c.security ? " [sec]" : ""}`;
    lines.push(
      label.padEnd(30) +
        `${Math.round(c.passRate * c.trials)}/${c.trials}`.padStart(7) +
        pct(c.formatOkRate).padStart(8) +
        pct(c.judge?.acceptRate ?? null).padStart(10) +
        c.avgLlmCalls.toFixed(1).padStart(7) +
        kTokens(c.avgInputTokens + c.avgOutputTokens).padStart(9),
    );
  }
  const o = r.overall;
  lines.push(
    "",
    `Overall: pass ${pct(o.passRate)}  security ${pct(o.securityPassRate)}  format ${pct(o.formatOkRate)}  judge accepts ${pct(o.judge?.acceptRate ?? null)}` +
      (o.judge ? `  (warmth ${o.judge.warmth}, specificity ${o.judge.specificity}, ease ${o.judge.easyToReply}${o.judge.errors ? `, ${o.judge.errors} judge errors` : ""})` : ""),
  );
  return lines.join("\n");
}

/** What went wrong in failed trials, so you can decide whether the model or the check is at fault. */
export function formatFailures(r: RunReport, limit = 10): string {
  const failed = r.trials.filter((t) => !t.passed);
  if (failed.length === 0) return "No failed trials.";
  const lines = failed.slice(0, limit).map((t) => {
    const reasons = t.checks
      .filter((c) => !c.passed)
      .map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ""}`)
      .join("; ");
    return `FAIL ${t.caseId} #${t.trial}: ${reasons || t.error || "unknown"}`;
  });
  if (failed.length > limit) lines.push(`...and ${failed.length - limit} more failed trials (see the results file).`);
  return lines.join("\n");
}

export async function readReport(path: string): Promise<RunReport | null> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const parsed = JSON.parse(text) as Partial<RunReport>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.cases) || !parsed.overall) {
    throw new Error(`${path} is not a valid eval report`);
  }
  return parsed as RunReport;
}

export async function writeReport(path: string, report: RunReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
}