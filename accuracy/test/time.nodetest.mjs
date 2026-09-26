// Named *.nodetest.mjs (not *.test.mjs) so the app's vitest run does not pick it up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { localToUtc, hourKey } from "../lib/time.mjs";

test("Perth local time converts to UTC (+8, no daylight saving)", () => {
  assert.equal(localToUtc("2026-09-27T05:00", "Australia/Perth").toISOString(), "2026-09-26T21:00:00.000Z");
  assert.equal(localToUtc("2026-01-15T05:00", "Australia/Perth").toISOString(), "2026-01-14T21:00:00.000Z");
});

test("Sydney handles daylight saving (+10 in winter, +11 in summer)", () => {
  assert.equal(localToUtc("2026-07-01T06:00", "Australia/Sydney").toISOString(), "2026-06-30T20:00:00.000Z");
  assert.equal(localToUtc("2026-12-01T06:00", "Australia/Sydney").toISOString(), "2026-11-30T19:00:00.000Z");
});

test("hourKey is a stable UTC hour label", () => {
  assert.equal(hourKey(new Date("2026-09-26T21:37:12Z")), "2026-09-26T21:00Z");
});
