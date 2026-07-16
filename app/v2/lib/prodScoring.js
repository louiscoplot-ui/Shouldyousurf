// v2/lib/prodScoring.js — THE canonical scoring engine. app/page.js contains
// no scoring anymore (it's a theme wrapper around MainScreen); this file is
// the single source of truth for all surf logic. Locked by tests/scoring.test.mjs.

export const mToFt = m => m * 3.281;
export const knToKmh = kn => kn * 1.852;

// currentVelToMs — normalise ocean_current_velocity vers des m/s quelle que
// soit l'unité annoncée par l'API (response.hourly_units). Tout l'aval
// suppose des m/s : les paliers hazard de classifyConditions (0.28 / 0.56)
// et l'affichage UI (× 3.6 pour montrer des km/h). La Marine API Open-Meteo
// sert ce champ en km/h par défaut selon la doc publique (invérifiable en
// live depuis l'env de session, proxy 403) — d'où la lecture de l'unité
// RÉELLE annoncée dans la réponse plutôt qu'un pari sur un défaut : si le
// champ arrive déjà en m/s rien ne change, s'il arrive en km/h les seuils
// sur-déclenchaient ×3.6 (bandeau "strong rip" sur un courant négligeable)
// et le courant affiché était gonflé d'autant.
export function currentVelToMs(v, unit) {
  if (!Number.isFinite(v)) return null;
  const u = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  if (u === "km/h" || u === "kmh" || u === "kph") return v / 3.6;
  if (u === "kn" || u === "kt" || u === "knots") return v * 0.514444;
  if (u === "mph") return v * 0.44704;
  return v; // "m/s", vide ou inconnue → tel quel (comportement historique)
}

// Per-spot swell attenuation — offshore Hs is what the wave model sees at
// the grid cell; sheltered spots (offshore banks, islands, headlands) only
// receive a fraction of it. 1.0 = fully exposed (default, non-regression).
// Values live on the spot in breaks.js (`swellAttenuation`).
export function spotAttenuation(spot) {
  const a = spot ? spot.swellAttenuation : null;
  return Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1.0;
}

export function estimateFaceHeight(swellHeight, swellPeriod, attenuation = 1) {
  // Period boost reflects how long-period swell builds at the break.
  // But this only matters when there's enough water mass to build with —
  // tiny swells stay tiny faces regardless of period (a 0.3m @ 13s reads
  // as 0.3m at the beach). The boost ramps in CONTINUOUSLY between 0.4m
  // and 0.8m (smoothstep) instead of switching on at a hard 0.5m — the
  // old cliff made 1cm of swell change the displayed face by ~45%
  // (0.49m@14s → 1.6ft vs 0.50m@14s → 2.3ft).
  //
  // `attenuation` scales the offshore Hs down to what actually reaches the
  // break (spotAttenuation) — applied BEFORE the period boost and the ramp
  // thresholds, exactly once per call chain.
  const hEff = swellHeight * attenuation;
  const periodFactor = Math.min(1.8, Math.max(0.7, swellPeriod / 10));
  const t = Math.max(0, Math.min(1, (hEff - 0.4) / 0.4));
  const blend = t * t * (3 - 2 * t); // smoothstep 0→1 over 0.4–0.8m
  return hEff * (1 + (periodFactor - 1) * blend);
}

// Angular delta helper — |((a - b + 540) % 360) - 180|, the shortest
// angle between two compass directions. Was copy-pasted 7× across the file.
export function angDelta(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// pickDominantSwell — the surfable wave is not always the PRIMARY swell
// partition. Open-Meteo's primary can be 0.4m of off-axis windswell while
// a 1.5m @ 15s groundswell sits in the secondary partition, plumb on the
// spot's ideal direction (classic Perth: local sea over a Five Fathom Bank
// groundswell). Score/verdict/face must follow the partition a surfer
// would actually ride: weight = height² (energy) × direction fit × period.
// Returns { swellHeight, swellPeriod, swellDir, isSecondary }.
// swellPartitions — les deux partitions normalisées + leurs poids. Le poids
// de la secondaire monte en smoothstep de 0 (≤0.2m) à plein (≥0.4m) au lieu
// de l'ancienne coupure sèche à 0.3m (falaise de 6 pts pour 1cm). Partagé
// par pickDominantSwell (verdict/face) et scoreV2 (blend de score) pour que
// les deux ne puissent jamais diverger sur "qui est dominante".
export function swellPartitions(h, spot) {
  const ideal = Number.isFinite(spot?.idealSwellDir) ? spot.idealSwellDir : null;
  const fit = (dir) => (ideal != null && dir != null) ? lookupDirMult(angDelta(dir, ideal)) : 1.0;
  const priPKnown = Number.isFinite(h.swellPeriod);
  const pri = {
    swellHeight: Number.isFinite(h.swellHeight) ? h.swellHeight : 0,
    swellPeriod: priPKnown ? h.swellPeriod : 10, // 10s = periodFactor 1.0 pour la face
    swellDir: Number.isFinite(h.swellDir) ? h.swellDir : null,
    isSecondary: false,
    periodKnown: priPKnown,
  };
  const weight = (p) => p.swellHeight * p.swellHeight
    * (p.periodKnown ? lookupPeriodMult(p.swellPeriod) : 1.0) * fit(p.swellDir);
  const w1 = weight(pri);
  const secH = Number.isFinite(h.secSwellH) ? h.secSwellH : null;
  let sec = null, w2 = 0;
  if (secH != null && secH > 0.2) {
    const secPKnown = Number.isFinite(h.secSwellP);
    sec = {
      swellHeight: secH,
      swellPeriod: secPKnown ? h.secSwellP : 10,
      swellDir: Number.isFinite(h.secSwellDir) ? h.secSwellDir : null,
      isSecondary: true,
      periodKnown: secPKnown,
    };
    const g = Math.max(0, Math.min(1, (secH - 0.2) / 0.2));
    w2 = weight(sec) * (g * g * (3 - 2 * g));
  }
  return { pri, sec, w1, w2 };
}

export function pickDominantSwell(h, spot) {
  const { pri, sec, w1, w2 } = swellPartitions(h, spot);
  return sec && w2 > w1 ? sec : pri;
}

// getDominant — lecture UNIQUE de la partition dominante. realFetch la
// calcule une fois par heure et la cache sur `hour.dom` ; tous les
// lecteurs (classify, chips, breakdown, modifiers, session notes, board)
// passent par ici au lieu de re-piocher h.swellHeight (la primaire) —
// c'était la source des affichages "1.3 ft" sur un jour scoré 51.
export function getDominant(h, spot) {
  const d = h ? h.dom : null;
  if (d && Number.isFinite(d.swellHeight)) return d;
  return pickDominantSwell(h, spot);
}

// faceFtOf — LA hauteur de face (ft) d'une heure : partition dominante +
// atténuation du spot, calculée une fois dans shapeHour (hour.faceFt) et
// recalculée seulement en fallback (heures mock / synthétiques).
export function faceFtOf(h, spot) {
  if (h && Number.isFinite(h.faceFt)) return h.faceFt;
  const dom = getDominant(h, spot);
  return mToFt(estimateFaceHeight(dom.swellHeight, dom.swellPeriod, spotAttenuation(spot)));
}

export const TIDE_TARGETS = { "low": 0.1, "mid-low": 0.3, "mid": 0.5, "mid-high": 0.7, "high": 0.9 };

// windClass — classification directionnelle UNIQUE du vent. Était copiée
// en 4 exemplaires (realFetch.classifyWind, classifyConditions, windContext,
// getWindTypeKey) avec les mêmes seuils 45°/135° et aucune garde contre la
// divergence. Renvoie null quand le delta est inconnu (spot sans
// offshoreWindDir) — l'appelant choisit son neutre EXPLICITEMENT au lieu
// de laisser des comparaisons NaN retomber silencieusement sur "cross".
export function windClass(deltaDeg) {
  if (!Number.isFinite(deltaDeg)) return null;
  if (deltaDeg <= 45) return "offshore";
  if (deltaDeg >= 135) return "onshore";
  return "cross";
}

// tideNotes — le SEUL consommateur runtime des anciennes notes de scoreSurf
// est la chip marée de drivingChipsFor (n_tide_prime / n_tide_wrong ;
// n_tide_ok conservée pour parité). L'ancien moteur additif complet
// recalculait ~80 lignes de score mort à chaque scoreV2 × heures × jours ×
// niveaux pour produire ces trois tags. Même logique de fenêtre relative
// que lookupTideMult (targets partagés via TIDE_TARGETS).
export function tideNotes(h, spot, tideCtx) {
  const notes = [];
  if (tideCtx && spot.idealTide && spot.idealTide !== "any" && h.tideM != null) {
    const range = tideCtx.max - tideCtx.min;
    if (range > 0.15) {
      const norm = (h.tideM - tideCtx.min) / range;
      const target = TIDE_TARGETS[spot.idealTide];
      if (target != null) {
        const delta = Math.abs(norm - target);
        if (delta < 0.15) notes.push("n_tide_prime");
        else if (delta < 0.3) notes.push("n_tide_ok");
        else if (delta > 0.6) notes.push("n_tide_wrong");
      }
    }
  }
  return notes;
}

// ─── V2 multiplicative scoring (skill: surf-scoring-engine) ────────────
// La taille est souveraine : baseSize(swellH_m, level) * combinedMult.
// Période + vent + direction + marée ajustent DANS la bande de taille,
// jamais au-dessus. finalMult clamp [0.40, 1.35] applique la règle
// "+35% max de bonus combinés" — au-delà ce serait nier la souveraineté
// de la taille. Ceiling défensif [0, 100] en sortie.
//
// Grille baseSize par niveau : keypoints (swellH_m, score) interpolés
// linéairement. Lit la skill en bandes (ex. early_int 0.85-1.25m peak
// 65-82) traduites en valeurs médianes aux limites de bande.
const BASE_SIZE_GRID = {
  first_timer: [
    [0, 5], [0.2, 35], [0.3, 50], [0.4, 28], [0.6, 12], [0.8, 5], [10, 5],
  ],
  beginner: [
    [0, 5], [0.25, 25], [0.45, 55], [0.6, 65], [0.75, 55], [1.0, 28], [1.3, 8], [10, 5],
  ],
  early_int: [
    [0, 5], [0.35, 16], [0.55, 30], [0.85, 60], [1.05, 78], [1.25, 60], [1.55, 25], [1.85, 5], [10, 5],
  ],
  intermediate: [
    [0, 5], [0.5, 8], [0.65, 30], [0.8, 38], [1.0, 52], [1.2, 62], [1.5, 78], [1.8, 87], [2.0, 70], [2.5, 42], [3.0, 30], [10, 18],
  ],
  advanced: [
    [0, 8], [0.8, 14], [1.2, 24], [1.5, 38], [1.8, 58], [2.0, 68], [2.15, 76], [2.5, 85], [3.0, 84], [3.5, 92], [4.5, 70], [6.0, 55], [10, 50],
  ],
  expert: [
    [0, 12], [1.0, 40], [1.4, 50], [1.8, 65], [2.5, 85], [3.0, 88], [3.5, 90], [4.0, 92], [5.0, 88], [10, 80],
  ],
};

export function lookupBaseSize(swellH, userLevel) {
  const grid = BASE_SIZE_GRID[userLevel] || BASE_SIZE_GRID.intermediate;
  if (swellH <= grid[0][0]) return grid[0][1];
  for (let i = 1; i < grid.length; i++) {
    if (grid[i][0] >= swellH) {
      const [m0, s0] = grid[i - 1];
      const [m1, s1] = grid[i];
      const ratio = (swellH - m0) / (m1 - m0);
      return s0 + (s1 - s0) * ratio;
    }
  }
  return grid[grid.length - 1][1];
}

// Peak baseSize possible pour un niveau donné — utile pour afficher des
// barres de progression "X / peak" plutôt que "X / 100" qui font lire
// au surfeur "il manque 35 points dispos" alors qu'il est literally au
// sommet de sa grille (first_timer peak = 50, beginner peak = 65, etc.).
export function levelPeakBaseSize(userLevel) {
  const grid = BASE_SIZE_GRID[userLevel] || BASE_SIZE_GRID.intermediate;
  let max = 0;
  for (const [, s] of grid) if (s > max) max = s;
  return max;
}

// lerpTable — interpolation linéaire sur une table de nœuds [x, y] triés.
// Clamp aux extrémités. Toutes les tables de multiplicateurs passent par
// là : les anciennes fonctions à paliers créaient des falaises de 15-28
// pts de score pour 0.1s de période ou 1° de vent (audit 2026-07). Les
// nœuds reprennent les valeurs historiques placées au CENTRE de chaque
// ancienne bande — aucune recalibration, juste la forme continue.
function lerpTable(x, nodes) {
  if (x <= nodes[0][0]) return nodes[0][1];
  for (let i = 1; i < nodes.length; i++) {
    if (x <= nodes[i][0]) {
      const [x0, y0] = nodes[i - 1];
      const [x1, y1] = nodes[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return nodes[nodes.length - 1][1];
}

// Anciennes bandes : <6→0.62, <8→0.80, <10→0.95, <12→1.12, <14→1.25,
// <16→1.35, ≥16→1.42 — nœuds aux centres (5,7,9,11,13,15,17).
const PERIOD_NODES = [[5, 0.62], [7, 0.80], [9, 0.95], [11, 1.12], [13, 1.25], [15, 1.35], [17, 1.42]];
export function lookupPeriodMult(s) {
  return lerpTable(s, PERIOD_NODES);
}

// Courbes de vitesse par classe de vent (nœuds aux centres des anciennes
// bandes <10/<20/<30/<50), puis fondu ENTRE les classes sur ±10° autour
// des anciennes frontières 45°/135° — la falaise "44° vs 46°" disparaît.
const WIND_OFFSHORE_NODES = [[5, 1.30], [15, 1.20], [25, 1.10], [40, 0.92], [60, 0.70]];
const WIND_CROSS_NODES    = [[5, 1.05], [15, 0.90], [30, 0.75]];
const WIND_ONSHORE_NODES  = [[5, 0.72], [15, 0.58], [25, 0.45], [40, 0.30]];
const mix = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

// windDelta = |((windDir - offshoreWindDir + 540) % 360) - 180|
// offshore: ≤45°, cross: 45-135°, onshore: ≥135° (fondu ±10° aux frontières)
export function lookupWindMult(windDelta, kmh) {
  const off = lerpTable(kmh, WIND_OFFSHORE_NODES);
  const cr  = lerpTable(kmh, WIND_CROSS_NODES);
  const on  = lerpTable(kmh, WIND_ONSHORE_NODES);
  if (windDelta <= 35) return off;
  if (windDelta < 55)  return mix(off, cr, (windDelta - 35) / 20);
  if (windDelta <= 120) return cr;
  if (windDelta < 150) return mix(cr, on, (windDelta - 120) / 30);
  return on;
}

// Anciennes bandes : ≤20→1.22, ≤40→1.10, ≤60→0.95, ≤80→0.75, ≤100→0.50,
// >100→0.25 — nœuds aux centres (10,30,50,70,90,110).
const DIR_NODES = [[10, 1.22], [30, 1.10], [50, 0.95], [70, 0.75], [90, 0.50], [110, 0.25]];
export function lookupDirMult(swellDelta) {
  return lerpTable(swellDelta, DIR_NODES);
}

// Dernière table à paliers du moteur passée en rampe (sprint continuité
// 2026-07) : les anciens seuils secs <0.15→1.06 / <0.30→1.02 / >0.60→0.92
// faisaient sauter le score de 4 à 8 pts pour 1 cm de marée aux frontières
// de fenêtre. Nœuds aux CENTRES des anciennes bandes — mêmes valeurs
// historiques, zéro recalibration, juste la forme continue (même méthode
// que PERIOD_NODES / WIND_*_NODES / DIR_NODES).
const TIDE_DELTA_NODES = [[0.075, 1.06], [0.225, 1.02], [0.45, 1.00], [0.75, 0.92]];

export function lookupTideMult(tideCtx, idealTide, tideM) {
  if (!tideCtx || !idealTide || idealTide === "any" || tideM == null) return 1.00;
  const range = tideCtx.max - tideCtx.min;
  if (range <= 0.15) return 1.00;
  const norm = (tideM - tideCtx.min) / range;
  const target = TIDE_TARGETS[idealTide];
  if (target == null) return 1.00;
  return lerpTable(Math.abs(norm - target), TIDE_DELTA_NODES);
}

const FINAL_MULT_MIN = 0.40;
const FINAL_MULT_MAX = 1.35;

// Plafond micro-swell PAR NIVEAU. L'ancien cap unique (12 à ≤0.35m → libéré
// à 0.65m) disait "personne ne surfe 0.35m" — vrai pour un shortboard,
// faux pour les niveaux dont la grille VIT là : le peak first_timer
// (0.3m → baseSize 50, sa journée d'apprentissage idéale) était écrasé à
// 12/100 rouge "Skip", et la zone montante beginner (0.45-0.55m) à 25.
// Résultat : un first_timer n'avait JAMAIS un bon score, même le jour
// parfait — le score ne portait aucune information pour lui (et le verdict
// GO contredisait le hero rouge à l'écran). Le cap garde son rôle anti-
// mensonge (sous le seuil bas de CHAQUE niveau, pas de vague = pas de
// score) mais son domaine suit la grille du niveau : il se libère là où
// la grille du niveau commence à exister, pas à un 0.65m universel.
// intermediate+ : inchangé bit-à-bit.
const MICRO_CAP_NODES = {
  first_timer: [[0.10, 12], [0.20, 25], [0.30, 100]],
  beginner:    [[0.20, 12], [0.35, 25], [0.50, 100]],
};
const MICRO_CAP_DEFAULT = [[0.35, 12], [0.50, 25], [0.65, 100]];

// scoreV2 — la formule multiplicative.
// Renvoie { score, notes, baseSize, multipliers } pour que ScoreSheet et
// les diagnostics puissent inspecter la décomposition. Les `notes` sont
// désormais réduites aux tags marée (tideNotes) — seul contenu que
// drivingChipsFor consomme réellement.
export function scoreV2(h, spot, userLevel, tideCtx) {
  const level = userLevel || "intermediate";
  // Guards : on ne propage PAS NaN. Une donnée manquante doit donner un
  // multiplicateur NEUTRE exact (1.00) — l'ancien défaut "période 10s"
  // passait par la table et offrait ×1.12 de bonus à une donnée absente.
  //
  // Le score est calculé pour CHAQUE partition de houle (primaire +
  // secondaire) puis fondu par poids relatif autour du point de bascule.
  // Un argmax sec (scorer uniquement la dominante) créait une falaise au
  // basculement primaire↔secondaire ; le blend rend la sortie continue
  // tout en restant fidèle à la partition dominante partout ailleurs
  // (sous 35% de poids relatif la secondaire ne pèse rien, au-dessus de
  // 65% elle porte tout — cf. probe continuité secSwellH).
  const att = spotAttenuation(spot);
  const windKn = Number.isFinite(h.windSpeedKn) ? h.windSpeedKn : 0;
  const kmh = knToKmh(windKn);
  const windDir = Number.isFinite(h.windDir) ? h.windDir : null;
  const windDelta = windDir != null && Number.isFinite(spot.offshoreWindDir)
    ? angDelta(windDir, spot.offshoreWindDir)
    : null;
  const windMult = windDelta != null ? lookupWindMult(windDelta, kmh) : 1.00;
  const tideMult = lookupTideMult(tideCtx, spot.idealTide, h.tideM);
  const ideal = Number.isFinite(spot.idealSwellDir) ? spot.idealSwellDir : null;

  // ── Facteurs surface (rafales), indépendants de la partition ─────────
  // Appliqués HORS du clamp finalMult : dégradations de surface qui
  // doivent mordre même quand les bonus période/dir/vent saturent le clamp.
  // Rampe continue, anciens paliers (15→0.93, 25→0.85) comme ancres aux
  // centres — un delta de rafale de 14.9 vs 15.1 km/h ne saute plus.
  let gustMult = 1.0;
  if (Number.isFinite(h.windGustKn)) {
    const gustDelta = knToKmh(h.windGustKn) - kmh;
    gustMult = lerpTable(gustDelta, [[10, 1.0], [20, 0.93], [30, 0.85]]);
  }

  // ── Score d'une partition : hauteur EFFECTIVE (× atténuation spot,
  // appliquée UNE fois ici), baseSize, multiplicateurs, chop, micro-cap.
  const partScore = (part) => {
    const hEff = part.swellHeight * att;
    const baseSize = lookupBaseSize(hEff, level);
    const periodMult = part.periodKnown ? lookupPeriodMult(part.swellPeriod) : 1.00;
    const swellDelta = (part.swellDir != null && ideal != null) ? angDelta(part.swellDir, ideal) : null;
    const dirMult = swellDelta != null ? lookupDirMult(swellDelta) : 1.00;
    // Chop windswell : pénalité en rampe sur le ratio (anciens paliers
    // 0.5→0.91 / 0.8→0.82 comme ancres), modulée par une porte de période
    // qui s'éteint entre 9.5s et 11s (avant : conditions sèches <10s/<11s).
    let chopMult = 1.0;
    if (Number.isFinite(h.windWaveHeight) && hEff > 0.3 && part.periodKnown) {
      const ratio = h.windWaveHeight / Math.max(0.3, hEff);
      const ratioPenalty = lerpTable(ratio, [[0.4, 1.0], [0.65, 0.91], [0.9, 0.82]]);
      const pGate = 1 - Math.max(0, Math.min(1, (part.swellPeriod - 9.5) / 1.5));
      chopMult = 1 - (1 - ratioPenalty) * pGate;
    }
    const rawCombined = periodMult * windMult * dirMult * tideMult;
    const finalMult = Math.max(FINAL_MULT_MIN, Math.min(FINAL_MULT_MAX, rawCombined));
    let s = baseSize * finalMult * gustMult * chopMult;
    // Micro-swell : plafond en RAMPE, domaine par niveau (cf. MICRO_CAP_NODES).
    const capNodes = MICRO_CAP_NODES[level] || MICRO_CAP_DEFAULT;
    const capEnd = capNodes[capNodes.length - 1][0];
    if (hEff < capEnd) s = Math.min(s, lerpTable(hEff, capNodes));
    return { s, baseSize, periodMult, dirMult, chopMult, finalMult };
  };

  const { pri, sec, w1, w2 } = swellPartitions(h, spot);
  const priRes = partScore(pri);
  let score = priRes.s;
  let chosen = priRes;
  if (sec && w2 > 0 && (w1 + w2) > 0) {
    const secRes = partScore(sec);
    const t = w2 / (w1 + w2);
    const b = Math.max(0, Math.min(1, (t - 0.35) / 0.3));
    const blend = b * b * (3 - 2 * b); // 0 sous 35% de poids, 1 au-dessus de 65%
    score = priRes.s + (secRes.s - priRes.s) * blend;
    if (w2 > w1) chosen = secRes; // cohérent avec pickDominantSwell
  }

  // ── Safety override vent (skill: "Sécurité absolue inviolable") ──────
  // Plafond continu en vitesse ET en direction, indépendant de la
  // partition. Onshore : descend de "pas de cap" (28 km/h) vers 15
  // (42 km/h) — centre 35 = l'ancien seuil sec. Cross : vers 25 entre
  // 43 et 57 km/h (centre 50 = l'ancien seuil sec, qui faisait une
  // falaise mesurée de 46 pts). Fondu entre régimes sur delta 120-150°
  // (aligné sur lookupWindMult), montée du régime cross sur 70-95°.
  if (windDelta != null) {
    const onshoreCap = lerpTable(kmh, [[28, 100], [42, 15]]);
    const crossCap   = lerpTable(kmh, [[43, 100], [57, 25]]);
    let cap = 100;
    if (windDelta >= 150) cap = onshoreCap;
    else if (windDelta >= 120) cap = mix(crossCap, onshoreCap, (windDelta - 120) / 30);
    else if (windDelta >= 95) cap = crossCap;
    else if (windDelta >= 70) cap = mix(100, crossCap, (windDelta - 70) / 25);
    score = Math.min(score, cap);
  }

  const notes = tideNotes(h, spot, tideCtx);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    notes,
    baseSize: Math.round(chosen.baseSize),
    multipliers: {
      period: chosen.periodMult,
      wind: windMult,
      dir: chosen.dirMult,
      tide: tideMult,
      gust: gustMult,
      chop: chosen.chopMult,
      combined: chosen.finalMult,
    },
  };
}

export function findNextTideEvent(hours, fromTime) {
  if (!hours || hours.length < 3) return null;
  const fromIdx = hours.findIndex(h => h.time === fromTime);
  const start = fromIdx >= 0 ? fromIdx : 0;
  for (let i = Math.max(1, start); i < hours.length - 1; i++) {
    const prev = hours[i - 1]?.tideM;
    const cur  = hours[i].tideM;
    const next = hours[i + 1]?.tideM;
    if (prev == null || cur == null || next == null) continue;
    if (cur > prev && cur >= next) return { kind: "high", time: hours[i].time, m: cur };
    if (cur < prev && cur <= next) return { kind: "low",  time: hours[i].time, m: cur };
  }
  return null;
}

export function dayTideCtx(dayHours) {
  if (!dayHours || !dayHours.length) return null;
  let min = Infinity, max = -Infinity, count = 0;
  for (const h of dayHours) {
    if (h.tideM == null) continue;
    if (h.tideM < min) min = h.tideM;
    if (h.tideM > max) max = h.tideM;
    count++;
  }
  if (count < 2) return null;
  return { min, max };
}

export function tideTrend(hours, sel) {
  if (!hours || !sel) return null;
  const idx = hours.findIndex(h => h.time === sel.time);
  if (idx < 1 || sel.tideM == null) return null;
  const prev = hours[idx - 1]?.tideM;
  if (prev == null) return null;
  const diff = sel.tideM - prev;
  if (Math.abs(diff) < 0.05) return "steady";
  return diff > 0 ? "rising" : "falling";
}

// v1 getWindTypeKey — returns translation key ("offshore"/"onshore"/"cross_shore")
// so the wind sub can read "S · cross-shore" in 12 languages.
export function getWindTypeKey(sel, spot) {
  const wc = windClass(angDelta(sel.windDir, spot.offshoreWindDir));
  return wc === "offshore" ? "offshore" : wc === "onshore" ? "onshore" : "cross_shore";
}

export function degToCompass(deg) {
  if (deg == null || isNaN(deg)) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export function fmtLongDay(isoDate, tz, t) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const diffDays = Math.round((dayDate.getTime() - new Date(todayStr + "T12:00:00Z").getTime()) / (1000*60*60*24));
  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("tomorrow");
  if (diffDays === -1) return t("yesterday");
  return dayDate.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function offsetDate(isoDate, n) {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// ── Per-user-level advice ──────────────────────────────────────────────
export const USER_LEVELS = ["first_timer", "beginner", "early_int", "intermediate", "advanced", "expert"];

export const USER_LEVEL_ZONES = {
  first_timer:  { min: 0.3, sweetLo: 0.6, sweetHi: 1.5, upperMax: 2.2 },
  beginner:     { min: 0.3, sweetLo: 1,   sweetHi: 2,   upperMax: 3 },
  // early_int : sweet = waist-to-head-high (2-4.5ft), cœur de la zone d'un
  // early intermediate. Avant : sweetHi 3 / upperMax 4 → tout 3.5-5ft clean
  // basculait en upper/too_big → verdict "ok" + tip "outside too much" alors
  // que c'est PILE sa journée. Resynchronisé avec BASE_SIZE_GRID qui peak
  // déjà à ~4.5ft face. Plafonné À intermediate (sweetHi 4.5 / upperMax 6)
  // SANS le dépasser → monotonie du ladder préservée (early_int jamais plus
  // tolérant qu'intermediate), tout en restant ≥ beginner. La distinction
  // avec intermediate vit dans sweetLo (2 vs 2.5 : early_int profite des
  // plus petites) + l'accès inside-reform que intermediate n'a pas.
  early_int:    { min: 1.5, sweetLo: 2,   sweetHi: 4.5, upperMax: 6 },
  intermediate: { min: 1.5, sweetLo: 2.5, sweetHi: 4.5, upperMax: 6 },
  advanced:     { min: 2,   sweetLo: 3,   sweetHi: 7,   upperMax: 10 },
  expert:       { min: 2.5, sweetLo: 4,   sweetHi: 10,  upperMax: 16 },
};

export function classifyConditions(userLevel, h, spot) {
  // Même partition dominante que scoreV2 — sinon le verdict jugerait la
  // primaire (chop 0.4m) pendant que le score note la secondaire (1.5m
  // groundswell) et les deux se contrediraient à l'écran. faceFtOf lit
  // le cache hour.faceFt (atténuation incluse) posé par shapeHour.
  const faceFt = faceFtOf(h, spot);
  const kmh = knToKmh(h.windSpeedKn);
  const windDelta = angDelta(h.windDir, spot.offshoreWindDir);
  // Spot sans offshoreWindDir → windClass null → neutre "cross" explicite.
  const wc = windClass(windDelta) || "cross";
  const isOffshore = wc === "offshore";
  const isOnshore = wc === "onshore";
  const isCross = wc === "cross";
  // On distingue cross-shore d'onshore pour le label "blown". Avant, tout
  // ce qui n'était pas offshore partageait le seuil onshore (18-20 km/h),
  // donc un cross-shore de 18-24 km/h était étiqueté "blown out" → tips
  // "wind is killing it / trashing the shape". Faux : un cross 20 km/h
  // c'est de la texture (bumpy), pas du blown out. Onshore vent dans la
  // face = shredde tôt (18-20) ; cross-shore = chop latéral, tient
  // jusqu'à ~30 km/h avant d'être vraiment blown.

  const z = USER_LEVEL_ZONES[userLevel] || USER_LEVEL_ZONES.intermediate;
  let size;
  if (faceFt < z.min) size = "too_small";
  else if (faceFt < z.sweetLo) size = "small";
  else if (faceFt <= z.sweetHi) size = "sweet";
  else if (faceFt <= z.upperMax) size = "upper";
  else size = "too_big";

  // Wind thresholds aligned with scoreSurf's onshore classification
  // (20 km/h = n_on_blown) so the label never contradicts the score number.
  // Only first_timer + beginner get the tighter 18 km/h threshold — they
  // haven't built the paddling / duck-diving chops yet. Early_int uses the
  // same 20 km/h as intermediate; they're between beginner and intermediate
  // in skill and the verdict ladder must stay monotonic.
  const isEarlyLearner = userLevel === "first_timer" || userLevel === "beginner";
  const blownNonOffshore = isEarlyLearner ? 18 : 20;
  const galeOffshore     = isEarlyLearner ? 45 : 55;

  let wind;
  if ((isOffshore && kmh < 25) || kmh < 8) wind = "clean";
  else if (
    (isOnshore && kmh >= blownNonOffshore) ||   // onshore dans la face = blown tôt
    (isCross && kmh >= 30) ||                     // cross-shore tient jusqu'à 30
    kmh >= 40 ||                                  // n'importe quelle direction à 40+
    (isOffshore && kmh >= galeOffshore)           // offshore gale
  ) wind = "blown";
  else wind = "bumpy";

  const reefTooMuch = (spot.heavy || spot.type === "reef") && isEarlyLearner;

  // Ocean-current hazard for learners — a rip drains them faster than they
  // can paddle against it. Open-Meteo returns velocity in m/s;
  // 0.28 m/s ≈ 1 km/h, 0.56 m/s ≈ 2 km/h. Covers early_int too : ils sont
  // sur un mid-length, pas encore le paddle pour remonter un vrai rip —
  // et les tips "courant" leur étaient déjà routés alors que le hazard
  // restait aveugle pour eux (trou relevé par l'audit).
  const hazardProne = isEarlyLearner || userLevel === "early_int";
  const curVel = h.currentVel || 0;
  const currentHazard = hazardProne && curVel >= 0.56 ? "dangerous"
                      : hazardProne && curVel >= 0.28 ? "strong"
                      : "none";
  return { size, wind, reefTooMuch, faceFt, currentHazard };
}

// isFoamieFriendly — the subset of users who should literally be riding a
// foamie (soft-top) as their primary board. First-timer + beginner only.
// Used by the board recommendation logic.
export function isFoamieFriendly(userLevel, spot) {
  return (userLevel === "first_timer" || userLevel === "beginner")
    && spot.type !== "reef" && !spot.heavy;
}

// hasInsideReform — the BROADER group that can fall back to the inside
// reform (smaller re-formed waves closer to shore) when the main peak is
// too big, too messy or blown out. Includes early_int: they paddle a
// mid-length, not a foamie, but they can still bail the outside and
// surf whitewater / inside walls when conditions demand it. Beach breaks
// only — heavy or reef spots don't offer this escape.
//
// Le plafond de la rescue est PAR NIVEAU. L'ancien ≤10 ft universel
// promettait un MAYBE "inside rescue" à un first_timer sur un jour de
// 9-10 ft de face : à cette taille le bord N'EST PAS un refuge (shorepound,
// backwash, rips au maximum — les écoles de surf annulent bien avant).
// Au-delà du plafond on retombe sur le chemin normal → too_big → "no"
// dur + danger banner pour first_timer/beginner. 6 ft first_timer / 8 ft
// beginner (aligné sur getBoardRec beginner qui coupait déjà à 8) /
// 10 ft early_int (inchangé — il a le paddle pour rentrer).
export const REFORM_MAX_FT = { first_timer: 6, beginner: 8, early_int: 10 };

export function hasInsideReform(userLevel, faceFt, spot) {
  const maxFt = REFORM_MAX_FT[userLevel];
  return maxFt != null && spot.type !== "reef" && !spot.heavy && faceFt <= maxFt;
}

// Advice key is verdict-aware: the tip must always match the SKIP / MAYBE /
// GO decision. The optional `displayedVerdict` arg lets the caller pass the
// score-derived band ("yes"/"ok"/"no") so the tip branch is locked to the
// label the user actually sees on screen — single source of truth, no risk
// of drift between this function and scoreForLevel's bounds. Falls back to
// recomputing via getPersonalVerdict when the caller doesn't have the score.
export function getPersonalAdviceKey(userLevel, h, spot, displayedVerdict) {
  const { size, wind, reefTooMuch, faceFt, currentHazard } = classifyConditions(userLevel, h, spot);
  const verdict = displayedVerdict || getPersonalVerdict(userLevel, h, spot);
  const foamie = hasInsideReform(userLevel, faceFt, spot);
  const { kmh, dir } = windContext(h, spot);
  const isLearner = userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int";

  // ── SKIP branch — explain why it's a no ─────────────────────────────
  if (verdict === "no") {
    // Current safety wins over wind/size storytelling — a learner with a
    // strong rip needs to hear about the rip first, even if the wind is
    // also blowing the surface up. Both "dangerous" and "strong" route
    // here since both now cap a learner to SKIP.
    if (currentHazard !== "none" && isLearner) return "tip_" + userLevel + "_current";
    if (reefTooMuch) return "tip_" + userLevel + "_reef";
    // Gale tip — only fire when wind is actually shredding the face.
    // Used to fire at kmh >= 35 unconditionally, but 35-40 km/h offshore
    // for an advanced/expert is still surfable — galeKills() doesn't
    // even trigger until 50+ offshore. The tip was misnaming the
    // problem. Now requires non-offshore (where 35 km/h IS shredding)
    // OR a true offshore-gale floor (≥50 km/h cross/offshore).
    if ((dir !== "offshore" && kmh >= 35) || kmh >= 50) return "tip_" + userLevel + "_gale";
    if (faceFt < 0.3) return "tip_" + userLevel + "_too_small";
    if (size === "too_big") return "tip_" + userLevel + "_too_big";
    if (size === "too_small") return "tip_" + userLevel + "_too_small";
    if (wind === "blown") return "tip_" + userLevel + "_blown_" + (size === "too_small" ? "small" : size === "too_big" ? "upper" : size);
    return "tip_" + userLevel + "_upper_bumpy"; // catch-all for edge cases
  }

  // ── MAYBE branch — surfable with caveats ────────────────────────────
  if (verdict === "ok") {
    // Learner rescue: outside is out of reach but the inside still offers
    // rideable reforms. Only reached when wind < 25 km/h (the learner cap
    // in getPersonalVerdict), so this tip is always truthful.
    if (foamie && (size === "too_big" || size === "upper" || wind === "blown")) {
      return "tip_" + userLevel + "_inside";
    }
    if (size === "too_big") return "tip_" + userLevel + "_too_big";
    if (size === "too_small") return "tip_" + userLevel + "_too_small";
    if (wind === "blown") return "tip_" + userLevel + "_blown_" + size;
    return "tip_" + userLevel + "_" + size + "_" + wind;
  }

  // ── GO branch — send it ─────────────────────────────────────────────
  return "tip_" + userLevel + "_" + size + "_" + wind;
}

export function getPersonalModifier(userLevel, h, spot) {
  const { size, wind, reefTooMuch } = classifyConditions(userLevel, h, spot);
  if (reefTooMuch) return null;
  if (size === "too_small" || size === "too_big") return null;
  if (wind === "blown") return null;

  // Partition dominante — le modifier "long period" doit parler de la
  // houle que le score note, pas de la primaire.
  const dom = getDominant(h, spot);
  const period = dom.periodKnown ? dom.swellPeriod : 0;
  const dirDelta = Math.abs(((dom.swellDir - spot.idealSwellDir + 540) % 360) - 180);
  const isLearner = userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int";

  if (period >= 14 && (size === "sweet" || size === "upper")) return "tip_mod_long_period";
  if (period > 0 && period < 8 && isLearner && (size === "sweet" || size === "small")) return "tip_mod_short_period";
  if (dirDelta > 75) return "tip_mod_off_angle";
  if (wind === "clean" && knToKmh(h.windSpeedKn) < 8) return "tip_mod_glassy";
  return null;
}

// Board recommendation per level + face size + period. Returns a short label
// for inline display plus a longer explanation for tooltips / ScoreSheet.
// First-timer and beginner always stay on a foamie (soft-top) — it's safer
// for them and anyone around them, and takes-offs are much more forgiving.
// When size / wind exceed their level we recommend riding the INSIDE reform
// on the foamie (whitewash after the peak breaks), never the outside peak.
export function getBoardRec(userLevel, faceFt, period, spot) {
  const foamie = isFoamieFriendly(userLevel, spot);
  const longP = period >= 12;
  if (userLevel === "first_timer") {
    if (faceFt < 0.6) return { short: "—", long: "Not enough wave — save your wax" };
    if (faceFt <= 2)  return { short: "Foamie 8'+", long: "8' or bigger soft-top. Stay in the whitewash — catch re-formed waves near the sand, don't paddle past the break" };
    if (foamie && faceFt <= REFORM_MAX_FT.first_timer) return { short: "Foamie inside only", long: "Peak is too much for a first-timer. Stay INSIDE on a foamie and ride the reform (smaller waves that form after the main wave breaks)" };
    return { short: "Watch today", long: "Beyond a first-timer's kit. Watch the ocean, learn where the rip is, try again when it's smaller" };
  }
  if (userLevel === "beginner") {
    if (faceFt < 0.6) return { short: "—", long: "Not enough wave" };
    if (faceFt <= 3)  return { short: "Foamie 7'–8'", long: "Soft-top 7' to 8' — easy paddle, forgiving take-offs, safer for everyone if you lose it" };
    if (foamie && faceFt <= REFORM_MAX_FT.beginner) return { short: "Foamie inside", long: "Peak's getting big — stay on the foamie in the reform (the smaller foam waves close to shore)" };
    return { short: "Wait smaller", long: "Too much for a beginner foamie — come back when it drops" };
  }
  if (userLevel === "early_int") {
    if (faceFt < 1.2) return { short: "Longboard 9'", long: "Only a longboard will catch this little energy" };
    if (faceFt <= 2.5) return { short: "Mid-length 7'", long: "7'0–7'6 mid-length. Plenty of paddle, catches cleanly, still forgiving on take-offs" };
    if (faceFt <= 4)  return { short: "Mid 6'10 / SB 6'8", long: "Mid-length 6'10 if you want easy waves, or try a shortboard 6'6–6'8 if you're feeling confident" };
    if (faceFt <= 6)  return { short: "Pick your waves", long: "Size is on the edge — stick with the mid-length, don't force the biggest sets, take the inside ones" };
    return { short: "Hold back", long: "Out of your range — watch a set, don't go unless you know the rip and the paddle-out" };
  }
  if (userLevel === "intermediate") {
    if (faceFt < 1.5) return { short: "Longboard", long: "Too soft for a shortboard — longboard or step off" };
    if (faceFt <= 2.5) return { short: "Fish / groveler 5'8–6'0", long: "Small-wave blade — a fish or groveler with volume so you keep moving through the soft sections" };
    if (faceFt <= 4.5) return { short: "Shortboard 5'11–6'4", long: "Your daily driver — the sweet spot for progressive surfing" };
    if (faceFt <= 6.5) return { short: longP ? "Step-up 6'4–6'6" : "Shortboard 6'2+", long: "Slightly longer board for paddle power and hold. On a long-period day size up a little" };
    return { short: "Hold back", long: "Overhead-plus is beyond your comfort zone — watch a set or two, don't force it" };
  }
  if (userLevel === "advanced") {
    if (faceFt < 2) return { short: "Longboard / fish", long: "Longboard for fun, or a fish if there's any push" };
    if (faceFt <= 3)  return { short: "Fish / groveler", long: "Small-wave board with volume" };
    if (faceFt <= 6)  return { short: "Shortboard 6'0–6'4", long: "Your daily driver zone" };
    if (faceFt <= 9)  return { short: "Step-up 6'6–7'0", long: "Step up — a bit more foam and length for paddle and hold in bigger surf" };
    if (faceFt <= 12) return { short: "Mini-gun 7'2+", long: "Big-wave territory — length and rail for commitment in the drop" };
    return { short: "Gun 7'6+", long: "Full big-wave kit — know the spot, know your limits, never alone" };
  }
  if (userLevel === "expert") {
    if (faceFt < 2)   return { short: "Longboard", long: "Fun longboard day" };
    if (faceFt <= 3)  return { short: "Groveler", long: "Small-wave blade" };
    if (faceFt <= 6)  return { short: "Shortboard", long: "Daily driver — whatever's in your bag for this size" };
    if (faceFt <= 9)  return { short: "Step-up 6'6–7'0", long: "Step up for paddle and hold" };
    if (faceFt <= 12) return { short: "Gun 7'2–7'6", long: "Proper gun — drop-ins and hold" };
    return { short: "Big-wave gun 8'+", long: "Full big-wave kit — tow options, safety crew, full protocol" };
  }
  return null;
}

// Strategy / safety bullets — contextual advice based on level + hour +
// day-wide patterns. Returns an array of short imperative strings that the
// UI can render as bullet points. Covers: current/rip safety, crowd, wind
// shift timing, tide strategy, period warnings.
export function getSessionNotes(userLevel, h, dayHours, spot) {
  const out = [];
  if (!h || !spot) return out;
  const cls = classifyConditions(userLevel, h, spot);
  const { size, wind, currentHazard } = cls;
  const kmh = knToKmh(h.windSpeedKn);

  // Safety first — current / rip
  if (currentHazard === "dangerous") {
    out.push("⚠ Strong rip running — do not paddle out, check with a lifeguard first");
  } else if (currentHazard === "strong") {
    out.push("⚠ Noticeable current — surf between flags, don't drift past the break");
  }

  // Reef / heavy spot warnings for levels below advanced
  if ((spot.heavy || spot.type === "reef") && (userLevel === "early_int" || userLevel === "intermediate")) {
    out.push("Reef / heavy spot — know the entry, watch the locals, don't drop in");
  }

  // Foamie inside advice for learners when conditions are too much — même
  // plafond par niveau que la rescue du verdict (REFORM_MAX_FT), sinon la
  // note promettrait un inside que getPersonalVerdict vient de refuser.
  if (isFoamieFriendly(userLevel, spot) && (size === "too_big" || size === "upper" || wind === "blown") && hasInsideReform(userLevel, cls.faceFt, spot) && cls.faceFt >= 0.3) {
    out.push("Stay INSIDE on the foamie — ride the reform close to shore, smaller and forgiving");
  }

  // Wind shift forecast — clean now but blows up later
  if (dayHours && wind !== "blown") {
    const myIdx = dayHours.findIndex((x) => x.time === h.time);
    if (myIdx >= 0) {
      const later = dayHours.slice(myIdx + 1).find((hh) => knToKmh(hh.windSpeedKn) > 22);
      if (later) {
        const laterH = new Date(later.time).getHours();
        out.push(`Wind picks up around ${laterH}:00 — prioritize the early`);
      }
    }
  }

  // Period warnings — sur la partition dominante (celle que le score note)
  const domSw = getDominant(h, spot);
  const period = domSw.periodKnown ? domSw.swellPeriod : 0;
  if (period >= 13 && (userLevel === "first_timer" || userLevel === "beginner" || userLevel === "early_int")) {
    out.push("Long-period swell — waves hit harder than they look, be patient with take-offs");
  } else if (period > 0 && period < 8 && (size === "sweet" || size === "upper")) {
    out.push("Short period — waves close out faster, read the line quickly or miss the wall");
  }

  // Cross-shore warning at bigger sizes for mid levels
  if (wind === "bumpy" && kmh >= 18 && (userLevel === "intermediate" || userLevel === "early_int")) {
    out.push("Cross-shore texture — paddle wider for a clean face, avoid the chop zones");
  }

  return out;
}

// Looks ahead in `hours` from `sel` and returns the first upcoming flip of
// windType (offshore / cross-shore / onshore). Scans up to 6 hours ahead.
// Returns { turnsTo, inHours } or null if the wind holds for the rest of
// the scan window. Used by HourlyList to render a lightweight "→ offshore
// in 2h"-style forecast next to the current windType label.
export function getWindTrend(sel, hours) {
  if (!sel || !hours || !sel.windType) return null;
  const idx = hours.indexOf(sel);
  if (idx < 0) return null;
  const MAX_LOOKAHEAD = 6;
  const end = Math.min(hours.length, idx + 1 + MAX_LOOKAHEAD);
  for (let i = idx + 1; i < end; i++) {
    const nxt = hours[i];
    if (nxt?.windType && nxt.windType !== sel.windType) {
      return { turnsTo: nxt.windType, inHours: i - idx };
    }
  }
  return null;
}

export function getTideModifier(sel, hours) {
  if (!sel || sel.tideM == null || !hours) return null;
  const trend = tideTrend(hours, sel);
  const next = findNextTideEvent(hours, sel.time);
  if (!next) return null;
  const hoursUntil = (new Date(next.time) - new Date(sel.time)) / 3600000;
  if (hoursUntil >= 0 && hoursUntil <= 2) {
    return next.kind === "high" ? "tip_mod_tide_high_soon" : "tip_mod_tide_low_soon";
  }
  if (trend === "rising") return "tip_mod_tide_rising";
  if (trend === "falling") return "tip_mod_tide_falling";
  return null;
}

// Wind "flavor" relative to the spot: direction class + kmh in one call.
// Keeps the universal-gale logic below from repeating itself.
function windContext(h, spot) {
  const kmh = knToKmh(h.windSpeedKn);
  const dir = windClass(angDelta(h.windDir, spot.offshoreWindDir)) || "cross";
  return { kmh, dir };
}

// Universal gale cap — a full-on windy day kills a session at any skill
// level at a beach break. Onshore is the strictest (sets get shredded
// before they form), cross-shore next (sideways chop), offshore the most
// permissive (experts can still score if the swell is there, but they
// get picked off their boards).
function galeKills(userLevel, kmh, dir) {
  const isPro = userLevel === "advanced" || userLevel === "expert";
  if (dir === "onshore" && kmh >= 35) return true;
  if (dir === "cross"   && kmh >= 40 && !isPro) return true;
  if (dir === "cross"   && kmh >= 50) return true;
  if (dir === "offshore" && kmh >= 50 && !isPro) return true;
  if (dir === "offshore" && kmh >= 65) return true;
  return false;
}

export function getPersonalVerdict(userLevel, h, spot) {
  const { size, wind, reefTooMuch, faceFt, currentHazard } = classifyConditions(userLevel, h, spot);
  // Current safety — overrides everything for learners who can't paddle
  // against a rip. "dangerous" = hard no; "strong" caps the verdict to
  // MAYBE below (never lets a learner see GO on a rippy day).
  if (currentHazard === "dangerous") return "no";
  if (reefTooMuch) return "no";

  const { kmh, dir } = windContext(h, spot);
  // Universal gale cap — applies to all levels. Even advanced/expert
  // don't get a rideable session at a beach break in a gale onshore.
  if (galeKills(userLevel, kmh, dir)) return "no";

  if (hasInsideReform(userLevel, faceFt, spot)) {
    if (faceFt < 0.3) return "no";
    // Strong current pulls a TRUE foamie learner (first_timer / beginner)
    // along the beach faster than they can paddle back even from the
    // inside → hard no. Early_int rides a mid-length with real paddle : the
    // lower "strong" tier only CAPS them to MAYBE (via the downgrade below),
    // it does not flip a perfect day to a red-banner SKIP. The "dangerous"
    // tier (0.56, ~2× stronger) is already a hard no above for everyone.
    // Fixes the 100→38 cliff : a 0.4 km/h bump in a noisy modeled current
    // used to flip an early_int's whole clean morning from Unreal-GO to
    // Fair-SKIP. "strong" stays surfaced as a caveat (session note +
    // GO→MAYBE downgrade), not a false alarm.
    if (currentHazard === "strong" && userLevel !== "early_int") return "no";
    // Wind === "blown" already means the surface is shredded enough
    // that the score collapses to ~0; the inside is just as choppy as
    // the outside in those conditions. Don't promise a learner an
    // "inside rescue" that doesn't exist. (For learners "blown" =
    // ≥18 km/h non-offshore — tighter than the 25 km/h cap below.)
    if (wind === "blown") return "no";
    // Learner-specific inside-reform cap: 25 km/h any direction. The
    // foamie/mid-length group can't handle more than that — 25+ onshore
    // is shorebreak chop, 25+ cross is side-chop, 25+ offshore picks them
    // off their boards. The universal cap above already handles the
    // harder gale range; this is the tighter learner-only threshold.
    if (kmh >= 25) return "no";
    // Early_int has no inside-reform "swim it out" rescue when there's
    // literally no wave (face below their min = 1.5ft). They're past
    // the foamie-whitewash phase and ride a longboard / mid-length —
    // sub-1.5ft is just a swim, not a session. First_timer / beginner
    // can still splash in the shorebreak so the "ok" path stays for them.
    if (size === "too_small" && userLevel === "early_int") return "no";
    // Même plafond ABSOLU too_big que le chemin non-reform (upperMax × 1.3,
    // cf. commentaire là-bas) : la branche reform court-circuitait le cap et
    // laissait un MAYBE "inside rescue" sur du 9 ft pour un early_int — au
    // large de sa marge et du cas D de la skill. First_timer / beginner
    // gardent leur vraie rescue foamie-whitewash (leur too_big n'est pas
    // le même océan : leurs zones coupent bien plus bas).
    if (size === "too_big" && userLevel === "early_int"
        && faceFt > USER_LEVEL_ZONES.early_int.upperMax * 1.3) return "no";
    // "strong" current (early_int only past the hard-no above) never lets a
    // GO through — same downgrade the non-reform path applies below, kept
    // consistent so the two chemins can't diverge on a rippy sweet day.
    const cap = currentHazard === "strong" ? "ok" : null;
    const downgrade = (v) => (cap && v === "yes" ? cap : v);
    if (size === "sweet" && wind === "clean") return downgrade("yes");
    return "ok";
  }
  if (wind === "blown") {
    if (size === "upper") return "no";
    if (size === "too_small") return "no";
    // Safety-first: blown wind + foamie-eligible learner (first_timer /
    // beginner) = HARD no. They can't punch through chop yet — the inside
    // reform rescue above already covers their fall-back. Early_int drops
    // through to "ok" like intermediate, since they're on a mid-length or
    // shortboard and can handle moderate blown conditions at the right size.
    if (userLevel === "first_timer" || userLevel === "beginner") return "no";
    return "ok";
  }
  if (size === "too_small") {
    // Foamie-eligible learners (first_timer / beginner) are caught earlier
    // in the hasInsideReform branch and get "ok" for splashing in shore-
    // break whitewash. Anyone reaching this point (intermediate+) doesn't
    // have a foamie rescue — sub-level-min is just a swim, no longboard
    // session worth calling MAYBE. SKIP is the honest call. Used to
    // return "ok" with a "longboard float" tip, which produced the
    // nonsense "WORTH IT — Too small — not enough push" matrix row.
    return "no";
  }
  if (size === "too_big") {
    // Foamie-eligible learners (first_timer / beginner) get the inside-
    // reform rescue above and never fall through to here. Early_int is
    // NOT on a foamie but they have enough paddle/duck-dive skill to
    // attempt — "ok" (MAYBE) instead of hard-no keeps the level ladder
    // monotonic (never stricter than beginner).
    if (userLevel === "first_timer" || userLevel === "beginner") return "no";
    // Plafond ABSOLU pour early_int / intermediate : au-delà de
    // upperMax × 1.3 (7.8 ft pour leurs zones à upperMax 6), ce n'est
    // plus "sur la limite, choisis tes vagues" mais franchement overhead.
    // L'intention d'origine (audit 2026-07) était une marge MAYBE de
    // +20-30% au-dessus d'upperMax (7.2-7.8 ft) — le code disait ×1.6
    // (9.6 ft) et laissait un MAYBE sur du 9 ft pour un early_int, en
    // contradiction avec la skill scoring (cas D : 2.0m/14s ≈ 9.2 ft de
    // face → SKIP early_int) et avec son propre commentaire. ×1.3 aligne
    // les trois. Advanced/expert gardent leur jugement.
    if (userLevel === "early_int" || userLevel === "intermediate") {
      const z = USER_LEVEL_ZONES[userLevel];
      if (faceFt > z.upperMax * 1.3) return "no";
    }
    return "ok";
  }
  const cap = currentHazard === "strong" ? "ok" : null;
  const downgrade = (v) => (cap && v === "yes" ? cap : v);
  if (size === "sweet") return downgrade(wind === "clean" ? "yes" : "ok");
  if (size === "upper") return downgrade(wind === "clean" ? "yes" : "ok");
  return "ok";
}

// Per-level score — utilise la formule multiplicative scoreV2 + un
// ceiling verdict-aware. La grille baseSize(swellH_m, level) encode déjà
// la perception par niveau (peak vs out-of-range), donc plus besoin
// d'additif size/wind par-dessus : tout est dans baseSize × multiplicateurs.
// Le ceiling SKIP/MAYBE garde la cohérence label↔score (pas de "score 80
// avec verdict no"), et c'est la même politique que la version additive.
// Sans userLevel passé, on tombe sur scoreV2 niveau intermediate (le
// baseline level-agnostic affiché avant que l'utilisateur choisisse).
export function scoreForLevel(h, spot, userLevel, tideCtx) {
  const v2 = scoreV2(h, spot, userLevel || "intermediate", tideCtx);
  if (!userLevel) return v2;
  const verdict = getPersonalVerdict(userLevel, h, spot);
  let adj = v2.score;
  // Compression douce de la queue haute au lieu d'un cap dur. Un
  // Math.min(adj, 70) aplatissait À 70 toutes les heures dont le score
  // brut dépassait 70 — fréquent pour early_int en zone upper/too_big
  // (verdict ok mais baseSize élevé) → "70 partout", zéro lisibilité sur
  // les meilleures heures. compressTail garde le score intact sous le
  // floor et remappe [floor..100] dans [floor..cap], donc le plafond
  // verdict est respecté (jamais de MAYBE en Unreal, ni de SKIP en Fair+)
  // tout en préservant l'ordre et la variation horaire.
  if (verdict === "no") adj = compressTail(adj, 30, 38);
  else if (verdict === "ok") adj = compressTail(adj, 55, 70);
  return {
    score: Math.max(0, Math.min(100, Math.round(adj))),
    notes: v2.notes,
    baseSize: v2.baseSize,
    multipliers: v2.multipliers,
  };
}

// Remappe [floor..100] dans [floor..cap] de façon monotone. En dessous
// du floor le score est inchangé (résolution naturelle préservée).
function compressTail(s, floor, cap) {
  if (s <= floor) return s;
  return floor + (s - floor) * ((cap - floor) / (100 - floor));
}

// Rebuilds a forecast payload so every hour.score is the level-adjusted
// value, and each day.bestHour is recomputed from that adjusted set. Safe
// to call on every userLevel change — O(days × hours), hundreds of ops.
// Returns a shallow-cloned payload so React sees new refs.
// Mirrors the verdict.js SCORE_SCALE — used by the day-tab dot, which only
// cares about the .color field. Kept inline here to avoid a cross-file
// import cycle inside the scoring module.
function scoreBandFromScore(s) {
  // Mirror exact de verdict.js SCORE_SCALE (recalibré post-multiplicatif).
  if (s >= 75) return { color: "#1d6a5b" };  // unreal
  if (s >= 60) return { color: "#2d9178" };  // excellent
  if (s >= 45) return { color: "#62a06a" };  // good
  if (s >= 30) return { color: "#a4a558" };  // fair
  if (s >= 15) return { color: "#d47559" };  // poor
  return           { color: "#b54c3f" };     // skip
}

export function adaptForecastToLevel(payload, userLevel, spot) {
  if (!payload || !payload.days) return payload;
  if (!userLevel) return payload;
  const days = payload.days.map((d) => {
    const tideCtx = d.tideCtx || dayTideCtx(d.hours);
    const hours = d.hours.map((h) => {
      const hDeg = { ...h, swellDir: h.swellDirDeg ?? h.swellDir, windDir: h.windDirDeg ?? h.windDir };
      const { score } = scoreForLevel(hDeg, spot, userLevel, tideCtx);
      return { ...h, baseScore: h.baseScore ?? h.score, score };
    });
    // Edge case : si l'API renvoie un day sans hours (rare mais possible
    // pour les jours d'archive partiellement disponibles), on évite le
    // crash hours[0].score sur undefined (audit SILENCIEUX #15).
    if (!hours.length) return { ...d, hours, bestHour: null, bestLevel: scoreBandFromScore(0) };
    let best = hours[0];
    for (const hh of hours) if (hh.score > best.score) best = hh;
    const bestLevel = scoreBandFromScore(best.score);
    return { ...d, hours, bestHour: best, bestLevel };
  });
  return { ...payload, days };
}

// Spot profile inference — pour les spots géocodés sans idealSwellDir
// pré-renseigné dans breaks.js. Utilise la moyenne pondérée des
// directions swell observées sur la fenêtre de fetch (passé + futur).
//
// Améliorations vs version naïve :
// 1) Pondère chaque sample par swellHeight² — les gros jours de houle
//    arrivent avec une direction "vraie" (long fetch open-ocean), les
//    micros sont du chop local bruité. Sans pondération, 24×0.2m de
//    chop random tirait la moyenne hors de la vraie exposition.
// 2) Filtre les sub-0.3m → trop bruité, dir Open-Meteo peu fiable.
// 3) Offshore présumé à 180° opposé : approximation "côte simple" qui
//    marche pour la majorité des beach breaks. Pour les spots en baie
//    abritée ou derrière headland, le user devra le détecter à l'usage
//    et on ajoutera une table régionale plus tard si besoin.
export function inferSpotProfile(allHours) {
  if (!allHours || allHours.length < 5) return null;
  const samples = allHours.filter(h =>
    Number.isFinite(h.swellDir) && h.swellDir >= 0 &&
    Number.isFinite(h.swellHeight) && h.swellHeight >= 0.3
  );
  if (samples.length < 5) return null;
  let sumX = 0, sumY = 0, totalW = 0;
  for (const h of samples) {
    const w = h.swellHeight * h.swellHeight;  // pondération quadratique
    sumX += Math.cos(h.swellDir * Math.PI / 180) * w;
    sumY += Math.sin(h.swellDir * Math.PI / 180) * w;
    totalW += w;
  }
  if (totalW < 0.5) return null;
  const avg = (Math.atan2(sumY / totalW, sumX / totalW) * 180 / Math.PI + 360) % 360;
  return { idealSwellDir: avg, offshoreWindDir: (avg + 180) % 360 };
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
