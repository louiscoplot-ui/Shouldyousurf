// End-to-end run of the logger with Open-Meteo answered by a fixture
// (test/fixtures/fake-open-meteo.mjs). The buoy stage is skipped so the
// test needs no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readJsonl } from "../lib/log-store.mjs";

const root = new URL("..", import.meta.url).pathname;

test("forecast and model stages write well-formed rows for every AU break", () => {
  const out = mkdtempSync(join(tmpdir(), "acc-log-"));
  execFileSync(process.execPath, [
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "--import", "./lib/register-esm.mjs", "--import", "./test/fixtures/fake-open-meteo.mjs",
    "scripts/daily-log.mjs", "--out", out, "--skip", "obs",
  ], { cwd: root, stdio: "pipe" });

  const f = readdirSync(join(out, "forecast")).flatMap((file) => readJsonl(join(out, "forecast", file)));
  const breaks = new Set(f.map((r) => r.break_id));
  assert.equal(breaks.size, 27, "every AU break has rows");
  for (const r of f) {
    assert.ok(r.lead_h >= 0 && r.lead_h < 72, "lead time inside the 72 h horizon");
    assert.match(r.valid_utc, /^\d{4}-\d{2}-\d{2}T\d{2}:00Z$/);
    assert.ok(Number.isFinite(r.face_ft));
    assert.equal(Object.keys(r.score).length, 6, "a score for each of the 6 levels");
    for (const v of Object.values(r.verdict)) assert.ok(["yes", "ok", "no"].includes(v));
  }
  const m = readdirSync(join(out, "model")).flatMap((file) => readJsonl(join(out, "model", file)));
  assert.equal(new Set(m.map((r) => r.site)).size, 9, "every offshore reference buoy has model rows");
  const runs = readJsonl(join(out, "runs.jsonl"));
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0].errors, []);
});
