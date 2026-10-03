// Rapport Instagram : données des slides, calculées avec le VRAI moteur de l'app (dossier app/ du repo).
// Aucun fichier du repo n'est modifié : le script lit app/, écrit uniquement dans --out.
//
//   node --import ./scripts/social/register.mjs scripts/social/report.mjs \
//        --date 2026-10-03 --out <dossier> [--payloads <json>] [--prev <slides-json précédent>]
//
// Sans --payloads : fetch des 27 spots AU (Open-Meteo, avec relances) et sauvegarde <out>/payloads-<date>.json.
// Sorties : <out>/report-<date>.txt (items 0 à 6) et <out>/slides-<date>.json (chaînes prêtes pour les slides).
//
// RÈGLE : une ligne de slide = une SESSION homogène (scripts/social/lib/sessions.mjs).
// Fenêtre, taille, vent, houle et verdict sont vrais pour TOUTES les heures de la ligne.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildSessions, windowText24, windowText12, faceText, swellText, windText, VERDICT_RANK } from "./lib/sessions.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DATE = arg("date");
const OUT = arg("out");
if (!DATE || !OUT) { console.error("usage: --date YYYY-MM-DD --out <dir> [--payloads f] [--prev f]"); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const root = new URL("../../app/", import.meta.url).href;
const ps = await import(root + "v2/lib/prodScoring.js");
const vd = await import(root + "v2/lib/verdict.js");
const { BREAKS } = await import(root + "breaks.js");

const sh = (...a) => { try { return execFileSync(a[0], a.slice(1), { cwd: new URL("../../", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const LEVELS = ps.USER_LEVELS;
const LNAME = { first_timer: "First timer", beginner: "Beginner", early_int: "Early intermediate", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" };
const VL = { yes: "GO", ok: "WORTH IT", no: "SKIP" };
const AU = BREAKS.filter((b) => b.country === "AU");
const RANKED = AU.filter((b) => b.id !== "gnaraloo");   // Gnaraloo : config en attente, jamais classé
const typeOf = (b) => (b.heavy ? "heavy" : b.type === "reef" ? "reef" : "beach");
const stOf = (b) => (b.region.match(/\b(WA|NSW|QLD|VIC|SA|TAS)\b/) || [, /Tasmania/.test(b.region) ? "TAS" : "?"])[1];
const shortName = (b) => b.name.replace(" (First Point)", "").replace(" (D'Bah)", "");
const pad = (s, n) => String(s).padEnd(n);
const p2 = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Données ─────────────────────────────────────────────────────────────────────
let payFile = arg("payloads");
let fetchedAt;
if (!payFile) {
  const { fetchRealForecast } = await import(root + "v2/lib/realFetch.js");
  const out = {}; const errs = [];
  for (const b of AU) {
    for (let k = 0; k < 4 && !out[b.id]; k++) {
      try { out[b.id] = { payload: await fetchRealForecast(b, new AbortController().signal) }; }
      catch (e) { if (k === 3) errs.push(`${b.id}: ${e.message}`); await sleep(5000); }
    }
    await sleep(600);
  }
  fetchedAt = new Date().toISOString();
  out.__meta = { fetchedAt };
  payFile = `${OUT}/payloads-${DATE}.json`;
  writeFileSync(payFile, JSON.stringify(out));
  if (errs.length) console.error("FETCH ERRORS:", errs.join("; "));
}
const PAY = JSON.parse(readFileSync(payFile, "utf8"));
fetchedAt = fetchedAt || PAY.__meta?.fetchedAt || null;
const missing = AU.filter((b) => !PAY[b.id]?.payload).map((b) => b.id);

// ── Une ligne (spot × niveau × jour) ─────────────────────────────────────────────
const tzAbbr = (tz) => new Intl.DateTimeFormat("en-AU", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(`${DATE}T04:00:00Z`)).find((x) => x.type === "timeZoneName").value;
const mins = (t) => +t.slice(11, 13) * 60 + +t.slice(14, 16);

function snap(id, lvl, D = DATE) {
  const b = AU.find((x) => x.id === id); const p = PAY[id].payload;
  const eff = { ...p.effectiveSpot, ...b };
  const ad = ps.adaptForecastToLevel(p, lvl, eff);
  const day = ad.days.find((d) => d.dateStr === D); if (!day) return null;
  const rawDay = p.days.find((d) => d.dateStr === D);
  const sun = p.sunByDay?.[D];
  const sr = Math.ceil((sun ? mins(sun.sunrise) : 360) / 60), ss = Math.floor((sun ? mins(sun.sunset) : 1080) / 60);
  const deg = (h) => ({ ...h, swellDir: h.swellDirDeg ?? h.swellDir, windDir: h.windDirDeg ?? h.windDir });
  const hrs = day.hours.filter((h) => h.hour >= sr && h.hour <= ss - 1).map((h) => {
    const dom = h.dom || {}; const sd = Number.isFinite(dom.swellDir) ? ps.degToCompass(dom.swellDir) : h.swellDir;
    return {
      hour: h.hour, score: h.score, verdict: VL[ps.getPersonalVerdict(lvl, deg(h), eff)],
      faceLow: h.faceFtLow, faceHigh: h.faceFtHigh, windKmh: h.windKmh, windDir: h.windDir, windType: h.windType,
      swellH: Number.isFinite(dom.swellHeight) ? dom.swellHeight : h.swellHeight,
      swellP: Number.isFinite(dom.swellPeriod) ? dom.swellPeriod : h.swellPeriod, swellDir: sd, _raw: h, _deg: deg(h),
    };
  });
  const S = buildSessions(hrs);
  const card = day.bestHour; const cardV = VL[ps.getPersonalVerdict(lvl, deg(card), eff)];
  return {
    id, lvl, D, b, eff, tz: tzAbbr(eff.timezone), sr, ss, sunrise: sun?.sunrise.slice(11), sunset: sun?.sunset.slice(11),
    hrs, day, rawDay, ...S, primary: S.sessions[0],
    card: { hour: card.hour, score: card.score, verdict: cardV, face: `${card.faceFtLow}-${card.faceFtHigh}ft`, windKmh: card.windKmh, windType: card.windType,
      where: card.hour < sr ? "BEFORE SUNRISE" : card.hour > ss - 1 ? "AFTER SUNSET" : "daylight",
      inSession: S.sessions.some((s) => s.hours.includes(card.hour)) },
  };
}
const ampm = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
const sessionText = (s, tz) => `${windowText24(s)} ${tz} (${windowText12(s)}) · ${faceText(s)} · ${swellText(s)} · ${windText(s)} · ${s.verdict} · peak ${s.peakScore} at ${ampm(s.peakHour)}`;

function slideRow(r) {
  const s = r.primary; const band = vd.getLevel(s.peakScore).label; const b = r.b;
  const flags = [];
  if (s.verdict === "GO" && s.peakScore < 40) flags.push("GO but score < 40");
  if (s.swell.pMin < 9) flags.push(`short swell ${Math.round(s.swell.pMin)}s`);
  if (s.wind.max >= 20) flags.push(`wind up to ${Math.round(s.wind.max)} km/h`);
  if (typeOf(b) !== "beach") flags.push(typeOf(b));
  if (r.card.where !== "daylight") flags.push(`app card ${r.card.where.toLowerCase()} (${ampm(r.card.hour)})`);
  return {
    id: r.id, name: shortName(b), state: stOf(b), type: typeOf(b), level: LNAME[r.lvl], date: r.D,
    score: s.peakScore, band, verdict: s.verdict, peakHour: ampm(s.peakHour),
    window24: `${windowText24(s)} ${r.tz}`, window12: `${windowText12(s)} ${r.tz}`,
    face: faceText(s), swell: swellText(s), wind: windText(s), flags,
    also: r.sessions.filter((x) => !x.primary && x.show).map((x) => ({
      window24: `${windowText24(x)} ${r.tz}`, window12: `${windowText12(x)} ${r.tz}`, verdict: x.verdict, peakScore: x.peakScore,
      peakHour: ampm(x.peakHour), face: faceText(x), swell: swellText(x), wind: windText(x),
    })),
    skipLater: r.sessions.filter((x) => !x.primary && !x.show).map((x) => `${windowText24(x)} ${x.verdict} (${faceText(x)}, ${windText(x)})`),
  };
}
const rowLine = (i, w) => `${pad(i ?? "", 3)}${pad(w.name, 21)}${pad(w.state, 5)}${pad(w.type, 7)}${pad(w.score, 6)}${pad(w.band, 10)}${pad(w.verdict, 10)}${pad(w.window24 + ` (${w.window12.replace(/ [A-Z]{3,4}$/, "")})`, 40)}${pad(w.face, 7)}${pad(w.swell, 22)}${w.wind}   [peak ${w.peakHour}]`;
const alsoLine = (a) => `      also: ${a.window24} (${a.window12.replace(/ [A-Z]{3,4}$/, "")}) · ${a.verdict} · ${a.face} · ${a.swell} · ${a.wind} · peak ${a.peakScore} at ${a.peakHour}`;

const L = []; const P = (s = "") => L.push(s);
const SL = { date: DATE, levels: {}, perth: {}, trigg3: [], card: [] };
const asserts = []; const check = (ok, msg) => asserts.push({ ok: !!ok, msg });

// ── ITEM 0 ──────────────────────────────────────────────────────────────────────
let deployed = null; try { deployed = (await (await fetch("https://shouldyousurf.com/version.json", { cache: "no-store" })).json()).version?.split("-")[0]; } catch {}
sh("git", "fetch", "origin", "main");
const mainSha = sh("git", "rev-parse", "--short", "origin/main"), head = sh("git", "rev-parse", "--short", "HEAD");
const appDiff = deployed && sh("git", "diff", "--stat", deployed, "origin/main", "--", "app") === "" ? "no difference in app/ (engine identical)" : deployed ? "app/ DIFFERS between prod and origin/main" : "unknown";
const awst = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" }).format(d) + " AWST";
P(`=== ITEM 0 — Instagram data for ${DATE}`);
P(`Deployed commit (shouldyousurf.com/version.json): ${deployed || "UNREADABLE"}   origin/main: ${mainSha}   local HEAD (engine used here): ${head}   -> ${appDiff}`);
P(`Forecast fetched: ${fetchedAt ? awst(new Date(fetchedAt)) : "unknown (payload file without metadata)"}   report generated: ${awst(new Date())}`);
if (missing.length) P(`!! MISSING PAYLOADS: ${missing.join(", ")}`);
const offs = (tz, d) => new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(`${d}T12:00:00Z`)).find((x) => x.type === "timeZoneName").value;
const shiftDay = (d, n) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const dstWarn = [...new Set(AU.map((b) => PAY[b.id]?.payload?.effectiveSpot?.timezone).filter(Boolean))].filter((tz) => offs(tz, shiftDay(DATE, -1)) !== offs(tz, DATE) || offs(tz, DATE) !== offs(tz, shiftDay(DATE, 1)));
if (dstWarn.length) P(`!! DST GUARD: clock change within ±1 day of ${DATE} for ${dstWarn.join(", ")}. Open-Meteo hour labels were measured at the OLD offset on a change day: regenerate AFTER the change has happened locally and eyeball the hours.`);

// ── ITEM 1 ──────────────────────────────────────────────────────────────────────
P(""); P(`=== ITEM 1 — TOP 5 AUSTRALIAN BREAKS PER LEVEL — ${DATE}`);
P("One row = one session: window, size, swell, wind and verdict are TRUE FOR EVERY HOUR of the window. 'peak' = hour of the score shown.");
const shown = new Map();
const rank = (lvl, D = DATE) => RANKED.filter((b) => PAY[b.id]?.payload).map((b, i) => ({ i, r: snap(b.id, lvl, D) })).filter((x) => x.r)
  .sort((a, c) => VERDICT_RANK[c.r.primary.verdict] - VERDICT_RANK[a.r.primary.verdict] || c.r.primary.peakScore - a.r.primary.peakScore || a.i - c.i);
for (const lvl of LEVELS) {
  const top = rank(lvl).slice(0, 5); SL.levels[lvl] = [];
  P(""); P(`-- ${LNAME[lvl].toUpperCase()}`);
  P(`${pad("#", 3)}${pad("Break", 21)}${pad("St", 5)}${pad("Type", 7)}${pad("Score", 6)}${pad("Band", 10)}${pad("Verdict", 10)}${pad("Window (local)", 40)}${pad("Face", 7)}${pad("Swell", 22)}Wind`);
  top.forEach(({ r }, k) => { const w = slideRow(r); shown.set(`${r.id}|${lvl}`, r); SL.levels[lvl].push(w); P(rowLine(k + 1, w)); w.also.forEach((a) => P(alsoLine(a))); w.skipLater.forEach((x) => P(`      later: ${x}`)); });
  check(top.every(({ r }, k) => k === 0 || VERDICT_RANK[top[k - 1].r.primary.verdict] > VERDICT_RANK[r.primary.verdict] || (VERDICT_RANK[top[k - 1].r.primary.verdict] === VERDICT_RANK[r.primary.verdict] && top[k - 1].r.primary.peakScore >= r.primary.peakScore)), `${lvl}: top-5 ordered GO first then score`);
}

// ── ITEM 2 ──────────────────────────────────────────────────────────────────────
P(""); P(""); P(`=== ITEM 2 — PERTH BREAKS, ALL 6 LEVELS — ${DATE}`);
for (const id of ["trigg", "cottesloe", "leighton", "scarborough"]) {
  const b = AU.find((x) => x.id === id); SL.perth[id] = [];
  P(""); P(`-- ${b.name} (${stOf(b)}, ${typeOf(b)})`);
  for (const lvl of LEVELS) { const r = snap(id, lvl); shown.set(`${id}|${lvl}`, r); const w = slideRow(r); SL.perth[id].push(w); P(rowLine("", { ...w, name: LNAME[lvl], state: "", type: "" })); w.also.forEach((a) => P(alsoLine(a))); w.skipLater.forEach((x) => P(`      later: ${x}`)); }
}

// ── ITEM 3 ──────────────────────────────────────────────────────────────────────
P(""); P(""); P(`=== ITEM 3 — TRIGG, NEXT 3 DAYS — First timer & Beginner`);
const dayLab = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(d + "T12:00:00Z"));
const item3 = [];
for (const lvl of ["first_timer", "beginner"]) for (const D of [DATE, shiftDay(DATE, 1), shiftDay(DATE, 2)]) {
  const r = snap("trigg", lvl, D); if (!r) continue; item3.push(r); const w = slideRow(r); SL.trigg3.push({ ...w, dayLabel: dayLab(D) });
  P(rowLine("", { ...w, name: `${LNAME[lvl]} ${dayLab(D)}`, state: "", type: "" })); w.also.forEach((a) => P(alsoLine(a)));
}

// ── ITEM 4 ──────────────────────────────────────────────────────────────────────
P(""); P(""); P("=== ITEM 4 — APP 'BEST WINDOW' CARD vs OUR SESSION (items 1-2 breaks)");
P("Card = day.bestHour = best-scoring hour among ALL hours 04h-20h (no daylight filter). Stats below are the CARD hour's own.");
P(`${pad("Break", 20)}${pad("Level", 19)}${pad("Our peak", 14)}${pad("App card (its own stats)", 58)}Verdict`);
const rows4 = [...shown.values()].sort((a, c) => AU.indexOf(a.b) - AU.indexOf(c.b) || LEVELS.indexOf(a.lvl) - LEVELS.indexOf(c.lvl));
let nPre = 0;
for (const r of rows4) {
  const c = r.card; let v = "same hour as our peak";
  if (c.where !== "daylight") { v = `${c.where} (!)`; nPre++; } else if (c.hour !== r.primary.peakHour) v = c.inSession ? "other hour, inside one of our sessions" : "OUTSIDE our sessions";
  SL.card.push({ id: r.id, level: LNAME[r.lvl], hour: ampm(c.hour), score: c.score, where: c.where });
  P(`${pad(shortName(r.b), 20)}${pad(LNAME[r.lvl], 19)}${pad(`${ampm(r.primary.peakHour)} ${r.primary.peakScore}`, 14)}${pad(`${ampm(c.hour)} ${c.score} ${c.verdict} ${c.face} ${Math.round(c.windKmh)} km/h ${c.windType}`, 58)}${v}  (sun ${r.sunrise}-${r.sunset})`);
}
P(`-> card before sunrise / after sunset: ${nPre} of ${rows4.length}`);

// ── ITEM 5 ──────────────────────────────────────────────────────────────────────
P(""); P(""); P("=== ITEM 5 — FLAGS");
const flag = (t) => P("  - " + t);
const allRows = [...shown.values(), ...item3];
const fl = (pred, label) => { const out = [...new Set(allRows.filter(pred).map((r) => `${shortName(r.b)} ${LNAME[r.lvl]}${r.D === DATE ? "" : " " + r.D}`))]; P(`[${label}]`); out.length ? out.forEach((x) => flag(x)) : flag("none"); };
fl((r) => r.primary.verdict === "GO" && r.primary.peakScore < 40, "GO with score < 40");
fl((r) => r.primary.verdict === "SKIP" && r.primary.peakScore > 29 || r.primary.verdict === "WORTH IT" && r.primary.peakScore > 59, "score / verdict ceiling contradictions");
fl((r) => typeOf(r.b) !== "beach", "heavy / reef breaks");
fl((r) => r.primary.swell.pMin < 9, "short-period swell < 9 s in the main session");
fl((r) => r.primary.wind.max >= 20, "wind >= 20 km/h inside the main session");
fl((r) => r.card.where !== "daylight", "app Best-window card outside daylight");
P("[config / data sanity, all 27 AU breaks]");
const TZ = { WA: "Australia/Perth", SA: "Australia/Adelaide", NSW: "Australia/Sydney", VIC: "Australia/Melbourne", QLD: "Australia/Brisbane", TAS: "Australia/Hobart" };
let cfg = 0; for (const b of AU) { const p = PAY[b.id]?.payload; if (!p) continue;
  if (p.effectiveSpot.timezone !== TZ[stOf(b)]) { flag(`${b.name}: payload timezone ${p.effectiveSpot.timezone}, state ${stOf(b)} expects ${TZ[stOf(b)]} (hours/sunrise may be offset)`); cfg++; }
  if (!p.sunByDay?.[DATE]) { flag(`${b.name}: no sunrise/sunset for ${DATE}`); cfg++; } }
if (!cfg) flag("none");
flag("Gnaraloo excluded from every ranking (config pending).");

// ── ITEM 6 : (was …) ────────────────────────────────────────────────────────────
P(""); P(""); P("=== ITEM 6 — CHANGES vs PREVIOUS REPORT");
const prevFile = arg("prev");
if (prevFile && existsSync(prevFile)) {
  const prev = JSON.parse(readFileSync(prevFile, "utf8"));
  const key = (w) => `${w.id}|${w.level}`;
  const flat = (S) => [...Object.values(S.levels).flat(), ...Object.values(S.perth).flat()];
  const pm = new Map(flat(prev).map((w) => [key(w), w])); let n = 0;
  for (const w of flat(SL)) { const o = pm.get(key(w)); if (!o) continue;
    const d = ["score", "band", "verdict", "window24", "face", "swell", "wind"].filter((k) => o[k] !== w[k]).map((k) => `${k} (was ${o[k]})`);
    if (d.length) { n++; P(`  ${w.name} / ${w.level}: ${d.join("; ")}`); } }
  P(`Compared with ${prev.date} (engine ${prev.engine || "?"} -> ${head}). ${n} row(s) differ. Cause is NOT split between forecast and code here: same engine = forecast update; different engine = look at the merged PRs between the two commits.`);
} else P("No --prev file given: no (was ...) marks.");
SL.engine = head;

// ── ASSERTIONS ──────────────────────────────────────────────────────────────────
for (const r of allRows) {
  const tag = `${r.id}/${r.lvl}/${r.D}`;
  for (const s of r.sessions) {
    const hs = r.hrs.filter((h) => s.hours.includes(h.hour));
    check(s.hours.every((h) => h >= r.sr && h <= r.ss - 1), `${tag}: session hours inside daylight`);
    check(new Set(hs.map((h) => `${h.verdict}|${h.faceLow}|${h.faceHigh}`)).size === 1, `${tag}: one verdict and one face per session`);
    check(s.wind.max - s.wind.min <= 8, `${tag}: wind spread in session <= 8 km/h`);
    check(s.peakScore === Math.max(...hs.map((h) => h.score)), `${tag}: session peak = max score`);
  }
  check(r.primary.peakScore === r.best.score && r.primary.hours.includes(r.best.hour), `${tag}: primary session holds the best-score hour`);
  check(r.hrs.every((h) => Number.isFinite(h.score)), `${tag}: no NaN score`);
  // Chemin indépendant : scoreForLevel appelé directement (même fonction que l'adaptateur, mais hors de sa boucle).
  check(r.hrs.every((h) => ps.scoreForLevel(h._deg, r.eff, r.lvl, r.rawDay.tideCtx || undefined).score === h.score) || !r.rawDay.tideCtx, `${tag}: scoreForLevel direct == adaptForecastToLevel`);
  check(r.hrs.every((h) => !(h.verdict === "SKIP" && h.score > 29) && !(h.verdict === "WORTH IT" && h.score > 59)), `${tag}: verdict ceilings respected`);
}
check(!missing.length, `27/27 payloads present (missing: ${missing.join(",") || "none"})`);
const bad = asserts.filter((a) => !a.ok);
P(""); P("=== ASSERTIONS"); P(`${asserts.length - bad.length}/${asserts.length} passed`); [...new Set(bad.map((a) => a.msg))].forEach((m) => P(`  FAIL: ${m}`));

writeFileSync(`${OUT}/report-${DATE}.txt`, L.join("\n"));
writeFileSync(`${OUT}/slides-${DATE}.json`, JSON.stringify(SL, null, 1));
console.log(L.join("\n"));
process.exit(bad.length ? 1 : 0);
