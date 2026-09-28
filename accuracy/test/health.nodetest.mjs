import { test } from "node:test";
import assert from "node:assert/strict";
import { healthProblems } from "../lib/health.mjs";

const opts = { breaks: 27, min: 0.8 };
const base = { forecast: { breaks_ok: 27 }, model: { sites_ok: 9, sites: 9 } };

test("28/09 case: 13 sites with data, 8 silent at source, none unreadable → healthy", () => {
  const s = { ...base, obs: { sites: 21, sites_ok: 13, sites_failed: 0, sites_silent: 8 } };
  assert.deepEqual(healthProblems(s, opts), []);
});

test("buoy sites we cannot read still fail the run", () => {
  const s = { ...base, obs: { sites: 21, sites_ok: 15, sites_failed: 6, sites_silent: 0 } };
  assert.equal(healthProblems(s, opts).length, 1);
});

test("no site with any observation fails, even with zero read errors", () => {
  const s = { ...base, obs: { sites: 21, sites_ok: 0, sites_failed: 0, sites_silent: 21 } };
  assert.match(healthProblems(s, opts).join(), /no site returned any observation/);
});

test("forecast and model keep the 80% rule", () => {
  assert.equal(healthProblems({ ...base, forecast: { breaks_ok: 21 } }, opts).length, 1);
  assert.equal(healthProblems({ ...base, model: { sites_ok: 7, sites: 9 } }, opts).length, 1);
  assert.deepEqual(healthProblems(base, opts), []);
});

test("skipped stages are ignored", () => {
  assert.deepEqual(healthProblems({ forecast: { breaks_ok: 27 } }, opts), []);
});
