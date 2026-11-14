#!/usr/bin/env node
// Terrain gap report. Reads a checkout of the accuracy-data branch and the
// hand-written field reports, writes a markdown report.
//
//   git clone --branch accuracy-data --depth 1 <repo> /tmp/adata
//   npm run gap -- --log /tmp/adata/log [--reports data/field-reports.jsonl] [--out gap.md]
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonl } from "../lib/log-store.mjs";
import { modelVsBuoy, appVsField, toMarkdown } from "../lib/terrain-gap.mjs";

const a = { reports: "data/field-reports.jsonl" };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--log") a.log = argv[++i];
  else if (argv[i] === "--reports") a.reports = argv[++i];
  else if (argv[i] === "--out") a.out = argv[++i];
  else { console.error(`unknown argument ${argv[i]}`); process.exit(1); }
}
if (!a.log || !existsSync(a.log)) { console.error("--log <dir> must point at the log/ folder of the accuracy-data branch"); process.exit(1); }

const readKind = (kind) => {
  const dir = join(a.log, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().flatMap((f) => readJsonl(join(dir, f)));
};

const md = toMarkdown({
  model: modelVsBuoy(readKind("model"), readKind("obs")),
  field: appVsField(readKind("forecast"), readJsonl(a.reports)),
  generatedAt: new Date().toISOString().slice(0, 16) + "Z",
});
if (a.out) writeFileSync(a.out, md); else process.stdout.write(md);
