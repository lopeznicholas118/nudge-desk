import {execSync } from "node:child_process";
import {copyFile } from "node:fs/promises";
import {parseArgs } from "node:util";
import {createAnthropicLlm} from "@nudge/agent";
import {CASES} from "./cases";
import {compareReports, securityFindings, type Finding} from "./compare";
import {loadEnv, packagePath, requireEnv} from "./env";
import {buildReport, formatFailures, formatReport, readReport, writeReport} from "./report";
import {runSuite} from "./runner";

const BASELINE = packagePath("baseline.json");

function gitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

function printFindings(findings: Finding[]) {
  for (const f of findings) console.log(`[${f.level.toUpperCase()}] ${f.message}`);
}

async function main() {
  loadEnv();
  const {values} = parseArgs({
    options: {
      trials: {type: "string"},
      only: {type: "string"},
      label: {type: "string"},
      concurrency: {type: "string"},
      "no-judge": {type: "boolean"},
      compare: {type: "string"},
      "save-baseline": {type: "boolean"},
      promote: {type: "string"},
      list: {type: "boolean"},
    },
  });

  if (values.list) {
    for (const c of CASES) console.log(`${c.id}${c.security ? " [security]" : ""}: ${c.description}`);
    return;
  }

  if (values.promote) {
    // Copy an existing results file over the baseline without spending anything.
    if (!(await readReport(values.promote))) throw new Error(`No such report: ${values.promote}`);
    await copyFile(values.promote, BASELINE);
    console.log(`Baseline updated from ${values.promote}`);
    return;
  }

  const trials = Number(values.trials ?? "3");
  const concurrency = Number(values.concurrency ?? "2");
  if (!Number.isInteger(trials) || trials < 1) throw new Error("--trials must be a positive integer");

  const wanted = values.only?.split(",").map((s) => s.trim()).filter(Boolean);
  const cases = wanted ? CASES.filter((c) => wanted.some((w) => c.id.includes(w))) : CASES;
  if (cases.length === 0) throw new Error(`No cases match --only ${values.only}. Try --list.`);

  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const agentModel = process.env.EVAL_AGENT_MODEL ?? requireEnv("ANTHROPIC_MODEL");
  const judgeModel = values["no-judge"] ? null : requireEnv("EVAL_JUDGE_MODEL");
  const agent = createAnthropicLlm({ apiKey, model: agentModel });
  const judge = judgeModel ? createAnthropicLlm({ apiKey, model: judgeModel }) : null;

  console.log(`Running ${cases.length} case(s) x ${trials} trial(s) on ${agentModel}, judge ${judgeModel ?? "off"}...`);
  const results = await runSuite({
    cases,
    trials,
    agent,
    judge,
    concurrency,
    onTrial: (t) => console.log(`${t.passed ? "PASS" : "FAIL"}  ${t.caseId} #${t.trial}  (${Math.round(t.durationMs / 1000)}s)`),
  });

  const label = values.label ?? "run";
  const report = buildReport({ label, gitSha: gitSha(), agentModel, judgeModel, trialsPerCase: trials }, cases, results);
  const file = packagePath(`results/${report.createdAt.replace(/[:.]/g, "-")}-${label}.json`);
  await writeReport(file, report);

  console.log(`\n${formatReport(report)}\n\n${formatFailures(report)}\n\nSaved ${file}`);

  const findings = securityFindings(report);
  const baselinePath = values.compare ?? BASELINE;
  const baseline = await readReport(baselinePath);
  if (baseline) {
    findings.push(...compareReports(baseline, report));
  } else {
    console.log(`\nNo baseline at ${baselinePath}. After a good run: pnpm eval --promote <results file>`);
  }
  if (findings.length > 0) {
    console.log("");
    printFindings(findings);
  }
  if (findings.some((f) => f.level === "fail")) process.exitCode = 1;

  if (values["save-baseline"]) {
    await writeReport(BASELINE, report);
    console.log(`\nBaseline saved to ${BASELINE}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});