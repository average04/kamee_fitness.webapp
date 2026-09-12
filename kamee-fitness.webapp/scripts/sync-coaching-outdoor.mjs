// Run from this project: node scripts/sync-coaching-outdoor.mjs [--check] <mobile-repo>
// These pure modules are shared across two repositories until a shared package
// is introduced. Never edit the generated mirror to change session semantics.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
const check = args.includes("--check");
const mobile = args.find(a => a !== "--check");
if (!mobile) throw new Error("Pass the mobile repository path.");
const target = resolve(dirname(fileURLToPath(import.meta.url)), "../lib/coaching/outdoor");
const files = {
  "lib/track/guidance/segments.ts": "segments.ts",
  "lib/track/guidance/plans.ts": "plans.ts",
  "lib/track/guidance/cueTimeline.ts": "cueTimeline.ts",
  "lib/plans/catalog/sessions.ts": "sessions.ts",
  "lib/plans/catalog/types.ts": "types.ts",
  "lib/plans/runDayForm.ts": "runDayForm.ts",
  "api/planCardio.ts": "planCardio.ts",
};
if (!check) await mkdir(target, { recursive: true });
for (const [source, name] of Object.entries(files)) {
  let content = (await readFile(resolve(mobile, "src", source), "utf8")).replaceAll("\r\n", "\n");
  for (const [from, to] of Object.entries(files)) content = content.replaceAll(`@/${from.slice(0, -3)}`, `./${to.slice(0, -3)}`);
  content = content.replace("import type { DayKind, Discipline } from '@/api/plans';", "type DayKind = 'workout' | 'rest' | 'active_recovery' | 'run' | 'hybrid';\ntype Discipline = 'strength' | 'running';");
  content = content.replace("import type { RunningPlanKind } from '@/lib/outdoorWizardRecommendation';", "type RunningPlanKind = string;");
  content = `// Mirrored from mobile ${source}; preserve native run/walk semantics.\n${content}`;
  const path = resolve(target, name);
  if (check) {
    if ((await readFile(path, "utf8")).replaceAll("\r\n", "\n") !== content) throw new Error(`Outdoor mirror drift: ${name}. Run sync without --check.`);
  } else await writeFile(path, content);
}
console.log(`${Object.keys(files).length} outdoor modules ${check ? "match mobile" : "synchronized"}.`);
