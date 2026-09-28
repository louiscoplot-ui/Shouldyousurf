// Plain JSON-lines files, one object per line, one file per month.
//   forecast/YYYY-MM.jsonl  append-only: what we predicted, frozen at run time
//   model/YYYY-MM.jsonl     append-only: Open-Meteo at each offshore buoy
//   obs/YYYY-MM.jsonl       merged: buoy measurements, one row per site-hour
//   runs.jsonl              append-only: one summary line per run
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { monthKey } from "./time.mjs";

function ensureDir(file) { mkdirSync(dirname(file), { recursive: true }); }

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

// Append rows, split by the month of `timeField`.
export function appendByMonth(root, kind, rows, timeField) {
  const byMonth = groupByMonth(rows, timeField);
  for (const [m, list] of byMonth) {
    const file = join(root, kind, `${m}.jsonl`);
    ensureDir(file);
    appendFileSync(file, list.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
}

// Merge rows into monthly files, keyed by `keyOf`. A newer row for the same
// key replaces the older one (buoy data arrives late and gets re-fetched).
// Output is sorted, so the file is stable and diffs stay small.
export function mergeByMonth(root, kind, rows, timeField, keyOf) {
  const byMonth = groupByMonth(rows, timeField);
  let added = 0, replaced = 0;
  for (const [m, list] of byMonth) {
    const file = join(root, kind, `${m}.jsonl`);
    const map = new Map(readJsonl(file).map((r) => [keyOf(r), r]));
    for (const r of list) {
      const k = keyOf(r);
      if (map.has(k)) replaced++; else added++;
      map.set(k, r);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, r]) => r);
    ensureDir(file);
    writeFileSync(file, sorted.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  return { added, replaced };
}

export function appendLine(file, obj) {
  ensureDir(file);
  appendFileSync(file, JSON.stringify(obj) + "\n");
}

function groupByMonth(rows, timeField) {
  const out = new Map();
  for (const r of rows) {
    const m = monthKey(r[timeField]);
    if (!out.has(m)) out.set(m, []);
    out.get(m).push(r);
  }
  return out;
}
