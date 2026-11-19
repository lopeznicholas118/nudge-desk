import {createDbClient} from "@nudge/db";
import {editRatio} from "./edit-ratio";
import {loadEnv, requireEnv} from "./env";
import {detectLanguage} from "./text";

async function main() {
  loadEnv();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  // This reads every user's drafts with the service role. Never point it at a real project.
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
    throw new Error(`Refusing to run: ${url} is not a local Supabase instance.`);
  }
  const db = createDbClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: drafts, error } = await db
    .from("drafts")
    .select("id, run_id, status, body, original_body")
    .in("status", ["approved", "sent", "discarded"]);
  if (error) throw error;

  const runIds = [...new Set((drafts ?? []).flatMap((d) => (d.run_id ? [d.run_id] : [])))];
  const versions = new Map<string, string>();
  if (runIds.length > 0) {
    const { data: runs, error: runError } = await db.from("agent_runs").select("id, prompt_version").in("id", runIds);
    if (runError) throw runError;
    for (const r of runs ?? []) versions.set(r.id, r.prompt_version);
  }

  type Group = { kept: number; discarded: number; ratios: number[] };
  const groups = new Map<string, Group>();
  for (const d of drafts ?? []) {
    const key = (d.run_id && versions.get(d.run_id)) || "unknown";
    const g = groups.get(key) ?? { kept: 0, discarded: 0, ratios: [] };
    groups.set(key, g);

    if (d.status === "discarded") {
      g.discarded++;
      continue;
    }
    g.kept++;
    if (d.original_body === null) continue;
    // A translated draft changed language, so a text diff would just measure the translation.
    const a = detectLanguage(d.original_body);
    const b = detectLanguage(d.body);
    if (a !== "unknown" && b !== "unknown" && a !== b) continue;
    g.ratios.push(editRatio(d.original_body, d.body));
  }

  if (groups.size === 0) {
    console.log("No reviewed drafts yet. Approve, send, or discard some in the app first.");
    return;
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  console.log("prompt version   kept  discarded  discard rate  mean edit  untouched  heavily edited (>50%)");
  for (const [version, g] of [...groups].sort()) {
    const total = g.kept + g.discarded;
    const n = g.ratios.length;
    const mean = n === 0 ? null : g.ratios.reduce((x, y) => x + y, 0) / n;
    console.log(
      `${version.padEnd(16)} ${String(g.kept).padStart(4)}  ${String(g.discarded).padStart(9)}  ${pct(g.discarded / total).padStart(12)}  ` +
        `${(mean === null ? "-" : pct(mean)).padStart(9)}  ${(n === 0 ? "-" : pct(g.ratios.filter((r) => r === 0).length / n)).padStart(9)}  ` +
        `${(n === 0 ? "-" : pct(g.ratios.filter((r) => r > 0.5).length / n)).padStart(21)}`,
    );
  }
  console.log("\nExcludes drafts that were translated (a translate-then-edit draft can't be told apart from a rewrite).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});