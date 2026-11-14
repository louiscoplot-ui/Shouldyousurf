#!/usr/bin/env node
// Offline run of the AI spot agent over the CURATED catalogue (app/breaks.js).
// For each break: research it on the web, compare the agent's bottom / heavy
// with what breaks.js says, and write a report. With --apply, the
// disagreements that pass the high-confidence gate are written into
// app/breaks.js; review the diff and commit it yourself.
//
//   ANTHROPIC_API_KEY=... node scripts/spot-agent.mjs --ids trigg,uluwatu
//   ANTHROPIC_API_KEY=... node scripts/spot-agent.mjs --country ID --out /tmp/id.md
//   ANTHROPIC_API_KEY=... node scripts/spot-agent.mjs --country AU --max 40 --apply
//
// Cost: one research is roughly 0.1-0.3 USD (estimate, depends on searches).
// --max (default 10) caps how many breaks one run may research.
// Never touches swellAttenuation, coordinates or directions.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { BREAKS } from "../app/breaks.js";
import { researchSpot } from "../app/lib/spotAgent.server.js";
import { isHighConfidence, distinctSourceHosts } from "../app/lib/spotProfile.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BREAKS_FILE = path.join(ROOT, "app/breaks.js");

function args(argv) {
  const out = { max: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--ids") out.ids = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--country") out.country = argv[++i].toUpperCase();
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--max") out.max = Number(argv[++i]);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

const currentOf = (b) => ({ bottom: b.type === "reef" ? "reef" : "beach", heavy: !!b.heavy });

// Rewrites one break's line in breaks.js. Returns the new source, or null if
// the line does not have the expected shape (then nothing is written).
export function rewriteBreakLine(src, id, { bottom, heavy }) {
  const lines = src.split("\n");
  const idx = lines.findIndex((l) => l.includes(`id: "${id}",`));
  if (idx < 0) return null;
  let line = lines[idx].replace(/\s*type: "[a-z]+",/, "").replace(/\s*heavy: true,/, "");
  const anchor = line.match(/offshoreWindDir: *\d+,/);
  if (!anchor) return null;
  const add = (bottom === "reef" ? ' type: "reef",' : "") + (heavy ? " heavy: true," : "");
  line = line.replace(anchor[0], anchor[0] + add);
  lines[idx] = line;
  return lines.join("\n");
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  let list = BREAKS;
  if (a.ids) list = list.filter((b) => a.ids.includes(b.id));
  if (a.country) list = list.filter((b) => b.country === a.country);
  if (!a.ids && !a.country) throw new Error("pick breaks with --ids or --country");
  if (list.length > a.max) throw new Error(`${list.length} breaks selected, above --max ${a.max} (raise it on purpose)`);

  const client = new Anthropic();
  const rows = [];
  for (const b of list) {
    process.stderr.write(`researching ${b.id}... `);
    try {
      const p = await researchSpot({ name: b.name, region: b.region || "", lat: b.lat, lng: b.lng }, { client });
      const cur = currentOf(b);
      const differs = p.bottom !== cur.bottom || p.heavy !== cur.heavy;
      rows.push({ b, p, cur, differs, high: isHighConfidence(p) });
      process.stderr.write(`${p.bottom}${p.heavy ? "+heavy" : ""} (${p.confidence})${differs ? " DIFFERS" : ""}\n`);
    } catch (e) {
      rows.push({ b, error: e.code || e.message });
      process.stderr.write(`error ${e.code || e.message}\n`);
    }
  }

  let src = fs.readFileSync(BREAKS_FILE, "utf8");
  const applied = [];
  if (a.apply) {
    for (const r of rows) {
      if (!r.p || !r.differs || !r.high) continue;
      const next = rewriteBreakLine(src, r.b.id, r.p);
      if (next) { src = next; applied.push(r.b.id); }
    }
    if (applied.length) fs.writeFileSync(BREAKS_FILE, src);
  }

  const fmt = (x) => `${x.bottom}${x.heavy ? " + heavy" : ""}`;
  const md = [
    `# Spot agent report`,
    ``,
    `${new Date().toISOString().slice(0, 16)}Z, ${rows.length} breaks. ${a.apply ? `Applied to app/breaks.js: ${applied.join(", ") || "none"}.` : "Report only (no --apply)."}`,
    ``,
    `| break | breaks.js | agent | confidence | sites | verdict |`,
    `|---|---|---|---|---|---|`,
    ...rows.map((r) => r.error
      ? `| ${r.b.id} | ${fmt(currentOf(r.b))} | error: ${r.error} | | | |`
      : `| ${r.b.id} | ${fmt(r.cur)} | ${fmt(r.p)} | ${r.p.confidence} | ${distinctSourceHosts(r.p).size} | ${!r.differs ? "agrees" : r.high ? (applied.includes(r.b.id) ? "**changed**" : "**would change**") : "differs, low confidence: review by hand"} |`),
    ``,
    `## Details`,
    ...rows.filter((r) => r.p).flatMap((r) => [
      ``, `### ${r.b.name} (${r.b.id})`, ``,
      `${r.p.reasoning}`, ``, `Exposure (text only, never applied): ${r.p.exposureNote}`, ``,
      ...r.p.sources.map((s) => `- ${s.url}: ${s.supports}`),
      r.p.droppedSources ? `- (${r.p.droppedSources} cited link(s) not returned by the search, dropped)` : "",
    ]),
  ].join("\n");
  if (a.out) fs.writeFileSync(a.out, md + "\n");
  else process.stdout.write(md + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
