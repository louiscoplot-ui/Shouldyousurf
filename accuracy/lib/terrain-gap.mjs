// Gap between what we forecast and what was really there. Pure functions
// over the daily-log rows (see daily-log.mjs); no network.
//
// Two comparisons:
//  A. model vs buoy, offshore: Open-Meteo at each offshore buoy (log/model)
//     against that buoy's measurement (log/obs). Says whether the RAW model
//     is biased at a site, before any of our transforms.
//  B. app vs field report, at the break: the face range the app showed
//     (log/forecast) against a surfer's report of what was really breaking
//     (data/field-reports.jsonl, written by hand). Says whether OUR
//     transforms (attenuation, face height) are off at a break.
// Deterministic: a gap is arithmetic, not a judgement call.

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

// Keep, for each key, the row with the shortest lead time (the freshest forecast).
function freshest(rows, keyOf, maxLeadH) {
  const best = new Map();
  for (const r of rows) {
    if (r.lead_h == null || r.lead_h < 0 || r.lead_h > maxLeadH) continue;
    const k = keyOf(r);
    const cur = best.get(k);
    if (!cur || r.lead_h < cur.lead_h) best.set(k, r);
  }
  return best;
}

export const MODEL_FLAG = { minHours: 24, ratioOff: 0.2 };

export function modelVsBuoy(modelRows, obsRows, { maxLeadH = 24 } = {}) {
  const model = freshest(modelRows, (r) => `${r.site}|${r.valid_utc}`, maxLeadH);
  const pairs = new Map();
  for (const o of obsRows) {
    if (!(o.hs > 0)) continue;
    const m = model.get(`${o.site}|${o.valid_utc}`);
    if (!m || !(m.hs > 0)) continue;
    if (!pairs.has(o.site)) pairs.set(o.site, []);
    pairs.get(o.site).push({ model: m.hs, obs: o.hs });
  }
  const out = [];
  for (const [site, ps] of pairs) {
    const ratio = median(ps.map((p) => p.model / p.obs));
    const bias = ps.reduce((s, p) => s + (p.model - p.obs), 0) / ps.length;
    const mae = ps.reduce((s, p) => s + Math.abs(p.model - p.obs), 0) / ps.length;
    const flagged = ps.length >= MODEL_FLAG.minHours && Math.abs(ratio - 1) > MODEL_FLAG.ratioOff;
    out.push({ site, hours: ps.length, medianRatio: round(ratio), biasM: round(bias), maeM: round(mae), flagged });
  }
  return out.sort((a, b) => a.site.localeCompare(b.site));
}

// Distance in ft between two ranges; 0 when they overlap.
export function rangeGapFt([aLo, aHi], [bLo, bHi]) {
  if (aHi < bLo) return bLo - aHi;
  if (bHi < aLo) return aLo - bHi;
  return 0;
}

export const FIELD_FLAG_FT = 1;

// report: { break_id, local: "YYYY-MM-DDTHH:00", face_ft_low, face_ft_high, note?, source? }
export function appVsField(forecastRows, reports, { maxLeadH = 72 } = {}) {
  const fc = freshest(forecastRows, (r) => `${r.break_id}|${r.local}`, maxLeadH);
  return reports.map((rep) => {
    const f = fc.get(`${rep.break_id}|${rep.local}`);
    if (!f) return { ...rep, matched: false };
    const app = [f.face_low, f.face_high];
    const seen = [rep.face_ft_low, rep.face_ft_high];
    const gap = rangeGapFt(app, seen);
    const direction = gap === 0 ? "overlap" : app[0] > seen[1] ? "app too big" : "app too small";
    return { ...rep, matched: true, lead_h: f.lead_h, app, seen, gapFt: round(gap, 1), direction,
      flagged: gap >= FIELD_FLAG_FT, verdict: f.verdict, swell: `${f.swell_h} m @ ${round(f.swell_p, 1)} s` };
  });
}

export function toMarkdown({ model, field, generatedAt }) {
  const L = [`# Terrain gap`, ``, `Generated ${generatedAt}.`, ``,
    `## A. Model vs buoy (offshore, lead ≤ 24 h)`, ``,
    `Flag: at least ${MODEL_FLAG.minHours} paired hours and a median model/buoy ratio off by more than ${MODEL_FLAG.ratioOff * 100} %.`, ``,
    `| buoy | hours | median model/buoy | bias (m) | mean abs error (m) | flag |`, `|---|---|---|---|---|---|`,
    ...model.map((m) => `| ${m.site} | ${m.hours} | ${m.medianRatio} | ${m.biasM} | ${m.maeM} | ${m.flagged ? "**yes**" : ""} |`),
    ``, `## B. App vs field reports (at the break)`, ``];
  if (!field.length) L.push("No field reports yet. Add lines to `data/field-reports.jsonl` (see `data/field-reports.example.jsonl`).");
  else L.push(`Flag: the app's face range misses the reported range by ${FIELD_FLAG_FT} ft or more.`, ``,
    `| break | local time | app | reported | gap | flag | note |`, `|---|---|---|---|---|---|---|`,
    ...field.map((f) => f.matched
      ? `| ${f.break_id} | ${f.local} | ${f.app[0]}-${f.app[1]} ft | ${f.seen[0]}-${f.seen[1]} ft | ${f.gapFt} ft (${f.direction}) | ${f.flagged ? "**yes**" : ""} | ${f.note || ""} |`
      : `| ${f.break_id} | ${f.local} | no forecast logged for that hour | ${f.face_ft_low}-${f.face_ft_high} ft | | | ${f.note || ""} |`));
  return L.join("\n") + "\n";
}
