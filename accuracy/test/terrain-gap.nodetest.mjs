import { test } from "node:test";
import assert from "node:assert/strict";
import { modelVsBuoy, appVsField, rangeGapFt, toMarkdown } from "../lib/terrain-gap.mjs";

test("rangeGapFt: 0 on overlap, distance otherwise", () => {
  assert.equal(rangeGapFt([3, 5], [1, 3]), 0);
  assert.equal(rangeGapFt([3, 5], [1, 2]), 1);
  assert.equal(rangeGapFt([0, 1], [2, 4]), 1);
});

test("modelVsBuoy pairs the freshest model row with the buoy hour and flags a biased site", () => {
  const model = [], obs = [];
  for (let h = 0; h < 30; h++) {
    const t = `2026-11-01T${String(h % 24).padStart(2, "0")}:00Z`.replace("2026-11-01", h < 24 ? "2026-11-01" : "2026-11-02");
    model.push({ site: "A", valid_utc: t, lead_h: 40, hs: 9 });   // stale, must be ignored
    model.push({ site: "A", valid_utc: t, lead_h: 5, hs: 1.5 });
    obs.push({ site: "A", valid_utc: t, hs: 1.0 });
    model.push({ site: "B", valid_utc: t, lead_h: 5, hs: 1.05 });
    obs.push({ site: "B", valid_utc: t, hs: 1.0 });
  }
  const [A, B] = modelVsBuoy(model, obs);
  assert.equal(A.hours, 30);
  assert.equal(A.medianRatio, 1.5);
  assert.equal(A.flagged, true);
  assert.equal(B.flagged, false);
});

test("appVsField compares face ranges at the reported hour", () => {
  const fc = [
    { break_id: "x", local: "2026-11-14T17:00", lead_h: 30, face_low: 1, face_high: 2, swell_h: 1, swell_p: 10 },
    { break_id: "x", local: "2026-11-14T17:00", lead_h: 10, face_low: 3, face_high: 5, swell_h: 1.2, swell_p: 11 },
  ];
  const [r, miss] = appVsField(fc, [
    { break_id: "x", local: "2026-11-14T17:00", face_ft_low: 1, face_ft_high: 2 },
    { break_id: "y", local: "2026-11-14T17:00", face_ft_low: 1, face_ft_high: 2 },
  ]);
  assert.deepEqual(r.app, [3, 5]);
  assert.equal(r.gapFt, 1);
  assert.equal(r.direction, "app too big");
  assert.equal(r.flagged, true);
  assert.equal(miss.matched, false);
  assert.match(toMarkdown({ model: [], field: [r, miss], generatedAt: "t" }), /app too big/);
});
