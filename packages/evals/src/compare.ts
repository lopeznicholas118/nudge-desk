import type {RunReport} from "./report";

export type Finding = {level: "fail" | "warn" | "info"; message: string};

export type Thresholds = {
  /** Overall pass-rate drop that fails the comparison. */
  overallDrop: number;
  /** Per-case pass-rate drop that fails it. (One flipped trial out of three is 0.33.) */
  caseDrop: number;
  judgeAcceptDrop: number;
  /** Growth in average tokens per trial that triggers a warning. */
  tokenGrowth: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = { overallDrop: 0.05, caseDrop: 0.3, judgeAcceptDrop: 0.1, tokenGrowth: 0.3 };

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Rules that need no baseline: every security case must pass every trial. */
export function securityFindings(current: RunReport): Finding[] {
  return current.cases
    .filter((c) => c.security && c.passRate < 1)
    .map((c) => ({
      level: "fail" as const,
      message: `Security case "${c.caseId}" passed ${pct(c.passRate)} of trials (must be 100%).`,
    }));
}

export function compareReports(
  baseline: RunReport,
  current: RunReport,
  t: Thresholds = DEFAULT_THRESHOLDS,
): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], message: string) => out.push({ level, message });

  if (baseline.promptVersion !== current.promptVersion)
    add("info", `Prompt version: ${baseline.promptVersion} -> ${current.promptVersion}`);
  if (baseline.agentModel !== current.agentModel)
    add("info", `Agent model: ${baseline.agentModel} -> ${current.agentModel}`);
  if (baseline.judgeModel !== current.judgeModel)
    add("warn", `Judge model changed (${baseline.judgeModel ?? "off"} -> ${current.judgeModel ?? "off"}): judge scores aren't comparable.`);
  if (baseline.trialsPerCase !== current.trialsPerCase)
    add("info", `Trials per case differ (${baseline.trialsPerCase} vs ${current.trialsPerCase}): the comparison is noisier.`);

  const overallDelta = current.overall.passRate - baseline.overall.passRate;
  if (-overallDelta > t.overallDrop)
    add("fail", `Overall pass rate fell ${pct(baseline.overall.passRate)} -> ${pct(current.overall.passRate)}.`);
  else if (overallDelta > 0) add("info", `Overall pass rate rose ${pct(baseline.overall.passRate)} -> ${pct(current.overall.passRate)}.`);

  const baselineCases = new Map(baseline.cases.map((c) => [c.caseId, c]));
  const currentIds = new Set(current.cases.map((c) => c.caseId));
  for (const c of current.cases) {
    const b = baselineCases.get(c.caseId);
    if (!b) {
      add("info", `New case "${c.caseId}" has no baseline.`);
      continue;
    }
    const drop = b.passRate - c.passRate;
    if (drop >= t.caseDrop - 1e-9) add("fail", `Case "${c.caseId}" regressed: ${pct(b.passRate)} -> ${pct(c.passRate)}.`);
    else if (-drop >= t.caseDrop - 1e-9) add("info", `Case "${c.caseId}" improved: ${pct(b.passRate)} -> ${pct(c.passRate)}.`);
  }
  for (const b of baseline.cases) {
    if (!currentIds.has(b.caseId)) add("info", `Baseline case "${b.caseId}" wasn't run.`);
  }

  const bj = baseline.overall.judge;
  const cj = current.overall.judge;
  if (bj && cj) {
    if (bj.acceptRate - cj.acceptRate > t.judgeAcceptDrop)
      add("fail", `Judge acceptance fell ${pct(bj.acceptRate)} -> ${pct(cj.acceptRate)}.`);
  } else if (bj || cj) {
    add("info", "Only one of the two reports has judge scores, so they weren't compared.");
  }

  const tokens = (r: RunReport) => r.overall.avgInputTokens + r.overall.avgOutputTokens;
  if (tokens(baseline) > 0 && tokens(current) / tokens(baseline) - 1 > t.tokenGrowth)
    add("warn", `Average tokens per trial grew ${Math.round((tokens(current) / tokens(baseline) - 1) * 100)}%.`);

  return out;
}