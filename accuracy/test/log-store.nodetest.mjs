import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendByMonth, mergeByMonth, readJsonl } from "../lib/log-store.mjs";

test("appendByMonth splits rows into monthly files", () => {
  const dir = mkdtempSync(join(tmpdir(), "acc-"));
  appendByMonth(dir, "forecast", [{ valid_utc: "2026-09-30T23:00Z", a: 1 }, { valid_utc: "2026-10-01T00:00Z", a: 2 }], "valid_utc");
  assert.equal(readJsonl(join(dir, "forecast", "2026-09.jsonl")).length, 1);
  assert.equal(readJsonl(join(dir, "forecast", "2026-10.jsonl")).length, 1);
});

test("mergeByMonth keeps one row per key, newest wins, output sorted", () => {
  const dir = mkdtempSync(join(tmpdir(), "acc-"));
  const key = (r) => `${r.site}|${r.valid_utc}`;
  mergeByMonth(dir, "obs", [{ site: "B", valid_utc: "2026-09-26T02:00Z", hs: 1 }, { site: "A", valid_utc: "2026-09-26T01:00Z", hs: 1 }], "valid_utc", key);
  const r = mergeByMonth(dir, "obs", [{ site: "A", valid_utc: "2026-09-26T01:00Z", hs: 2 }], "valid_utc", key);
  assert.deepEqual(r, { added: 0, replaced: 1 });
  const rows = readJsonl(join(dir, "obs", "2026-09.jsonl"));
  assert.deepEqual(rows.map((x) => [x.site, x.hs]), [["A", 2], ["B", 1]]);
  assert.ok(readFileSync(join(dir, "obs", "2026-09.jsonl"), "utf8").endsWith("\n"));
});
