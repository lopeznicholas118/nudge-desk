import {describe, expect, it} from "vitest";
import {compareReports, securityFindings} from "./compare";
import type {CaseReport, RunReport} from "./report";

const mkCase = (caseId: string, passRate: number, security = false): CaseReport => ({
  caseId,
  description: "",
  security,
  trials: 3,
  passRate,
  failedChecks: {},
  formatOkRate: 1,
  judge: null,
  avgLlmCalls: 5,
  avgToolErrors: 0,
  avgInputTokens: 4000,
  avgOutputTokens: 500,
});

const mkReport = (over: Partial<RunReport> & { cases?: CaseReport[]; passRate?: number; judgeAccept?: number } = {}): RunReport => {
  const { cases = [mkCase("a", 1), mkCase("b", 1)], passRate = 1, judgeAccept, ...rest } = over;
  return {
    schemaVersion: 1,
    label: "x",
    createdAt: "2026-10-09T00:00:00Z",
    gitSha: null,
    agentModel: "m",
    judgeModel: judgeAccept === undefined ? null : "j",
    promptVersion: "v1",
    trialsPerCase: 3,
    overall: {
      totalTrials: 6,
      passRate,
      securityPassRate: null,
      formatOkRate: 1,
      judge:
        judgeAccept === undefined
          ? null
          : { drafts: 10, errors: 0, acceptRate: judgeAccept, warmth: 4, specificity: 4, easyToReply: 4, voiceMatch: null },
      avgLlmCalls: 5,
      avgToolErrors: 0,
      avgInputTokens: 4000,
      avgOutputTokens: 500,
    },
    cases,
    trials: [],
    ...rest,
  };
};

const levels = (findings: ReturnType<typeof compareReports>, level: string) =>
  findings.filter((f) => f.level === level).map((f) => f.message);

describe("compareReports", () => {
  it("has nothing to say about identical reports", () => {
    expect(compareReports(mkReport(), mkReport())).toEqual([]);
  });

  it("fails on an overall pass-rate drop", () => {
    expect(levels(compareReports(mkReport(), mkReport({ passRate: 0.9 })), "fail")[0]).toMatch(/Overall pass rate fell/);
  });

  it("fails on a per-case regression and notes improvements", () => {
    const findings = compareReports(
      mkReport({ cases: [mkCase("a", 1), mkCase("b", 0.33)] }),
      mkReport({ cases: [mkCase("a", 0.66), mkCase("b", 1)] }),
    );
    expect(levels(findings, "fail")).toEqual(['Case "a" regressed: 100% -> 66%.']);
    expect(levels(findings, "info")).toEqual(['Case "b" improved: 33% -> 100%.']);
  });

  it("fails when judge acceptance drops", () => {
    const findings = compareReports(mkReport({ judgeAccept: 0.9 }), mkReport({ judgeAccept: 0.7 }));
    expect(levels(findings, "fail")[0]).toMatch(/Judge acceptance fell/);
  });

  it("warns on token growth and on a changed judge model", () => {
    const current = mkReport();
    current.overall.avgInputTokens = 8000;
    current.judgeModel = "other";
    const warnings = levels(compareReports(mkReport(), current), "warn");
    expect(warnings.some((w) => /tokens per trial grew/.test(w))).toBe(true);
    expect(warnings.some((w) => /Judge model changed/.test(w))).toBe(true);
  });

  it("reports prompt-version changes and cases that were added or not run", () => {
    const findings = compareReports(
      mkReport({ cases: [mkCase("a", 1), mkCase("old", 1)] }),
      mkReport({ cases: [mkCase("a", 1), mkCase("new", 1)], promptVersion: "v2" }),
    );
    const info = levels(findings, "info");
    expect(info).toContain("Prompt version: v1 -> v2");
    expect(info).toContain('New case "new" has no baseline.');
    expect(info).toContain('Baseline case "old" wasn\'t run.');
  });
});

describe("securityFindings", () => {
  it("fails any security case below 100%, with no baseline needed", () => {
    const report = mkReport({ cases: [mkCase("inj", 0.66, true), mkCase("ok", 1, true), mkCase("plain", 0.1)] });
    expect(securityFindings(report).map((f) => f.message)).toEqual([
      'Security case "inj" passed 66% of trials (must be 100%).',
    ]);
  });
});