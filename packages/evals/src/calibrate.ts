import {readFile} from "node:fs/promises";
import {createAnthropicLlm} from "@nudge/agent";
import {LanguageSchema} from "@nudge/core";
import {z} from "zod";
import {loadEnv, packagePath, requireEnv} from "./env";
import {agreementStats, judgeDraft} from "./judge";

const ItemSchema = z.object({
  id: z.string(),
  language: LanguageSchema,
  context: z.record(z.string(), z.unknown()),
  body: z.string(),
  acceptable: z.boolean().nullable(),
});

async function main() {
  loadEnv();
  const items = z.array(ItemSchema).parse(JSON.parse(await readFile(packagePath("calibration.json"), "utf8")));

  const unlabeled = items.filter((i) => i.acceptable === null).map((i) => i.id);
  if (unlabeled.length > 0) {
    console.error(`Label these first (set "acceptable" to true or false): ${unlabeled.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const judge = createAnthropicLlm({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: requireEnv("EVAL_JUDGE_MODEL"),
  });

  const pairs: Array<{ human: boolean; judge: boolean }> = [];
  const lines: string[] = [];
  let errors = 0;

  for (const item of items) {
    if (item.acceptable === null) continue;
    const outcome = await judgeDraft(judge, {
      body: item.body,
      expectedLanguage: item.language,
      context: JSON.stringify(item.context),
      voiceSamples: [],
    });
    if (!outcome.ok) {
      errors++;
      lines.push(`${item.id.padEnd(12)} human=${item.acceptable}  judge=ERROR (${outcome.error})`);
      continue;
    }
    pairs.push({ human: item.acceptable, judge: outcome.verdict.acceptable });
    const mark = item.acceptable === outcome.verdict.acceptable ? "  ok " : "  XX ";
    const scores = `w${outcome.verdict.warmth} s${outcome.verdict.specificity} e${outcome.verdict.easy_to_reply}`;
    lines.push(`${mark}${item.id.padEnd(12)} human=${String(item.acceptable).padEnd(5)} judge=${String(outcome.verdict.acceptable).padEnd(5)} ${scores}  ${outcome.verdict.reason}`);
  }

  const stats = agreementStats(pairs);
  console.log(lines.join("\n"));
  console.log(
    `\nAgreement ${stats.agree}/${stats.n} (${Math.round(stats.agreement * 100)}%)  ` +
      `false accepts: ${stats.falseAccepts}  false rejects: ${stats.falseRejects}  judge errors: ${errors}`,
  );

  const usable = errors === 0 && stats.agreement >= 0.8 && stats.falseAccepts <= 1;
  console.log(
    usable
      ? "The judge is usable. Its accept/reject verdicts match your labels well enough to track."
      : "Not trustworthy yet. Tighten the rubric in judge.ts (or reconsider labels you disagree with) and rerun.",
  );
  if (!usable) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});