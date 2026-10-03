// Sessions : le cœur de la mise en forme des slides Instagram.
//
// LE BUG QUI A MIS CE MODULE EN PLACE (slide Intermediate, samedi 3 oct 2026) :
// une ligne affichait « Best 6-7am, 8-11am, 5-6pm » avec « 2-4 ft · 15 km/h
// SSW ». Le texte listait toutes les heures proches du meilleur score, mais
// les chiffres (taille, vent) étaient ceux d'UNE seule heure : 17h. Le matin,
// c'était 1-3 ft et 1 à 7 km/h. Deux conditions différentes sur la même ligne.
//
// LA RÈGLE QUI L'EMPÊCHE : une ligne de slide = UNE session = un groupe d'heures
// qui partagent EXACTEMENT les mêmes conditions affichées. Tout ce qu'on imprime
// (heures, verdict, taille, houle, vent, score) est vrai pour TOUTES les heures
// de la session, parce que la session est construite pour ça. Deux conditions
// différentes = deux sessions = deux lignes. Aucun chiffre n'est jamais pris
// sur une heure et collé à la fenêtre d'une autre.
//
// Ce module est PUR (aucun import du moteur, aucun réseau) : il reçoit des
// heures déjà calculées par le moteur de l'app et ne fait que les regrouper.
// Il est donc testable avec de vraies données (tests/social-sessions.test.mjs).

export const GOOD_MARGIN = 5;       // une heure est « bonne » si score >= meilleur - 5
export const LIGHT_WIND_KMH = 8;    // sous ce vent la direction ne compte pas (surface lisse)
export const WIND_SPREAD_MAX = 8;   // écart max (km/h) entre l'heure la plus calme et la plus venteuse d'une session
export const ALL_DAY_SHARE = 0.75;  // une session couvrant >= 75 % des heures de jour s'écrit « all day »

export const VERDICT_RANK = { GO: 2, "WORTH IT": 1, SKIP: 0 };

// Classe de vent d'une heure. Sous LIGHT_WIND_KMH la direction n'a aucun effet
// sur la surface : « 1 km/h SW cross » et « 6 km/h E offshore » sont la même
// condition (lisse). Au-dessus, offshore / cross-shore / onshore changent tout.
export function windClassOf(h) {
  return h.windKmh < LIGHT_WIND_KMH ? "light" : h.windType;
}

// Signature d'une heure : ce qui doit être identique pour que deux heures
// puissent partager une ligne de slide. La taille est celle AFFICHÉE
// (faceFtLow-faceFtHigh), pas la taille brute : le lecteur ne voit que celle-là.
export function signatureOf(h) {
  return [h.verdict, h.faceLow, h.faceHigh, windClassOf(h)].join("|");
}

const uniqueInOrder = (arr) => arr.filter((x, i) => x != null && arr.indexOf(x) === i);

// Runs d'heures consécutives dans une liste triée.
export function runsOf(hours) {
  const runs = [];
  for (const h of hours) {
    const last = runs[runs.length - 1];
    if (last && last.end === h.hour - 1) last.end = h.hour;
    else runs.push({ start: h.hour, end: h.hour });
  }
  return runs;
}

function summarise(group, allDayHours) {
  const hs = group;
  const scores = hs.map((h) => h.score);
  const peak = Math.max(...scores);
  const peakHour = hs.find((h) => h.score === peak);
  const winds = hs.map((h) => h.windKmh);
  const swellH = hs.map((h) => h.swellH);
  const swellP = hs.map((h) => h.swellP);
  const windows = runsOf(hs);
  const first = hs[0];
  return {
    hours: hs.map((h) => h.hour),
    windows,
    verdict: first.verdict,
    peakScore: peak,
    peakHour: peakHour.hour,
    minScore: Math.min(...scores),
    face: { low: first.faceLow, high: first.faceHigh },
    swell: {
      hMin: Math.min(...swellH), hMax: Math.max(...swellH),
      pMin: Math.min(...swellP), pMax: Math.max(...swellP),
      dirs: uniqueInOrder(hs.map((h) => h.swellDir)),
    },
    wind: {
      min: Math.min(...winds), max: Math.max(...winds),
      dirs: uniqueInOrder(hs.map((h) => h.windDir)),
      types: uniqueInOrder(hs.map((h) => h.windType)),
      cls: windClassOf(first),
    },
    allDay: hs.length / allDayHours >= ALL_DAY_SHARE,
    coverage: `${hs.length}/${allDayHours}`,
  };
}

// buildSessions(hours) :
//   hours = heures de JOUR uniquement, triées, déjà notées par le moteur pour UN
//   niveau : { hour, score, verdict, faceLow, faceHigh, windKmh, windDir, windType,
//              swellH, swellP, swellDir }.
// Retourne { best, threshold, sessions } ; sessions[0] est la session PRINCIPALE
// (celle qui contient l'heure du meilleur score), les autres sont triées par
// score. `show` dit si une autre session mérite d'apparaître sur le slide : elle
// doit avoir un verdict au moins aussi bon que la principale (une session
// « SKIP » l'après-midi n'est pas une alternative, c'est un avertissement).
export function buildSessions(hours) {
  if (!hours.length) return { best: null, threshold: null, sessions: [] };
  let best = hours[0];
  for (const h of hours) if (h.score > best.score) best = h;   // égalité : la plus tôt
  const threshold = best.score - GOOD_MARGIN;
  const good = hours.filter((h) => h.score >= threshold);

  // Regroupement glouton par signature. Une heure rejoint un groupe existant si
  // (a) mêmes conditions affichées et (b) le vent du groupe resterait dans la
  // fourchette WIND_SPREAD_MAX. Sinon elle ouvre un nouveau groupe.
  const groups = [];
  for (const h of good) {
    const sig = signatureOf(h);
    const g = groups.find((x) => {
      if (x.sig !== sig) return false;
      const lo = Math.min(x.min, h.windKmh), hi = Math.max(x.max, h.windKmh);
      return hi - lo <= WIND_SPREAD_MAX;
    });
    if (g) { g.hours.push(h); g.min = Math.min(g.min, h.windKmh); g.max = Math.max(g.max, h.windKmh); }
    else groups.push({ sig, hours: [h], min: h.windKmh, max: h.windKmh });
  }

  const sessions = groups.map((g) => ({ ...summarise(g.hours, hours.length), primary: g.hours.includes(best) }));
  sessions.sort((a, b) => (b.primary - a.primary) || (b.peakScore - a.peakScore) || (a.hours[0] - b.hours[0]));
  const primaryRank = VERDICT_RANK[sessions[0].verdict];
  sessions.forEach((s) => { s.show = s.primary || VERDICT_RANK[s.verdict] >= primaryRank; });
  return { best, threshold, sessions };
}

// ── Mise en texte (une seule source, utilisée partout) ────────────────────────
const p2 = (n) => String(n).padStart(2, "0");

export function windowText24(s) {
  if (s.allDay) return `all day (${s.coverage}h)`;
  return s.windows.map((r) => `${p2(r.start)}-${p2(r.end + 1)}h`).join(" + ");
}

const h12 = (h) => ((h + 11) % 12) + 1;
const ap = (h) => (h % 24 < 12 ? "am" : "pm");
export function windowText12(s) {
  if (s.allDay) return "all day";
  return s.windows.map((r) => {
    const a = r.start, b = r.end + 1;
    return ap(a) === ap(b) || b === 24 ? `${h12(a)}-${h12(b)}${ap(b)}` : `${h12(a)}${ap(a)}-${h12(b)}${ap(b)}`;
  }).join(", ");
}

export function faceText(s) {
  return `${s.face.low}-${s.face.high}ft`;
}

const r1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
export function swellText(s) {
  const h = s.swell.hMin.toFixed(1) === s.swell.hMax.toFixed(1) ? r1(s.swell.hMin) : `${r1(s.swell.hMin)}-${r1(s.swell.hMax)}`;
  const pa = Math.round(s.swell.pMin), pb = Math.round(s.swell.pMax);
  const p = pa === pb ? `${pa}` : `${pa}-${pb}`;
  return `${h}m @ ${p}s ${s.swell.dirs.join("/")}`;
}

const dirsText = (d) => (d.length <= 2 ? d.join("→") : `${d[0]}→${d[d.length - 1]}`);
export function windSpeedText(s) {
  const a = Math.round(s.wind.min), b = Math.round(s.wind.max);
  return a === b ? `${a} km/h` : `${a}-${b} km/h`;
}
export function windTypeText(s) {
  if (s.wind.cls === "light") return "light";
  return s.wind.types.map((t) => (t === "cross-shore" ? "cross" : t)).join("/");
}
export function windText(s) {
  // Vent léger : la direction n'a aucun effet sur la surface, on ne l'affiche pas
  // (« 1-6 km/h light »). Sinon on collerait « SE→SW » sur une mer lisse.
  if (s.wind.cls === "light") return `${windSpeedText(s)} light`;
  return `${windSpeedText(s)} ${dirsText(s.wind.dirs)} ${windTypeText(s)}`;
}
