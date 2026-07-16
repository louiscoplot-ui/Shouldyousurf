# CLAUDE.md — Should You Surf?

Lis ce fichier en entier avant chaque session. Il contient tout le contexte du projet.

---

## IDENTITÉ PROJET

- Nom produit : Should You Surf?
- Domaine prod : shouldyousurf.com (Vercel project "aussie-surf")
- Repo : github.com/louiscoplot-ui/Shouldyousurf
- Founder : Louis Coplot
- Pitch : surf check app — score 0-100 par heure, prévision 5j, verdict perso par niveau (first_timer → expert), 27 spots Australie pré-chargés + recherche libre

---

## STACK

- Next.js 14.2.35 + React 18.3.1 (App Router)
- Tests : vitest (`npm test`) — `tests/scoring.test.mjs` verrouille les invariants du moteur. OBLIGATOIRE avant push si tu touches au scoring.
- APIs : Open-Meteo Marine + Forecast (GFS/ICON) — gratuit, no key. ⚠️ tier gratuit = non-commercial, migration plan Standard 29$/mois à prévoir.
- Analytics : PostHog US Cloud + Session Replay (`NEXT_PUBLIC_POSTHOG_KEY`) + GA (gtag dans layout.js)
- Microsoft Clarity : `NEXT_PUBLIC_CLARITY_ID` non set → script no-op
- Hosting : Vercel auto-deploy depuis `main`

---

## REPO & BRANCHES

- `main` : prod, Vercel auto-déploie
- `claude/resume-session-2pbVi` : branche d'intégration dev. Push toujours là quand le proxy bloque main.

⚠️ POLICY PROXY GIT
Sur certaines sessions, push direct sur `main` retourne HTTP 403. Fallback obligatoire :
```
git push origin main:claude/resume-session-2pbVi
```
Lien de merge à donner à Louis pour passer en prod :
https://github.com/louiscoplot-ui/Shouldyousurf/compare/main...claude/resume-session-2pbVi

---

## ARCHITECTURE

### Routes
- `/` (`app/page.js`) : LA prod — wrapper thème (111 lignes) qui rend `MainScreen` v2 + sync `meta theme-color` iOS. Il n'y a plus de "v1" nulle part.
- `/v2` : redirect 308 permanent vers `/` (next.config.mjs). Ne pas y remettre de contenu.
- `app/robots.js` + `app/sitemap.js` : SEO natifs Next.

### Thème — appliqué EN 2 ENDROITS (obligatoire)
- `.v2-stage[data-theme="..."]` (wrapper React)
- `:root[data-theme="..."]` (documentElement, pour les portals comme ScoreSheet qui sortent de `.v2-stage`)

Si tu ajoutes un nouveau bloc theme, mets-le aux DEUX endroits.

### Fichiers clés scoring (`app/v2/lib/`)

- `prodScoring.js` — toute la logique métier surf. **Moteur UNIQUE, 100% CONTINU** (sprint 2026-07 : plus aucun palier dur — toutes les tables passent par `lerpTable`, tous les caps sont des rampes ; tests de continuité assert saut < 3 pts par pas fin).
  - `spotAttenuation(spot)` : fraction du Hs offshore qui atteint le break (`swellAttenuation` sur le spot, défaut 1.0). Perth métro 0.55-0.60 (Five Fathom Bank / Rottnest) — TODO calibration bouées. Appliquée UNE fois par chemin (estimateFaceHeight / hauteur effective de scoreV2).
  - `estimateFaceHeight(swell, period, attenuation)` : conversion swell → face avec period boost en rampe continue 0.4→0.8m (smoothstep sur la hauteur ATTÉNUÉE).
  - `swellPartitions(h, spot)` / `pickDominantSwell` / `getDominant(h, spot)` / `faceFtOf(h, spot)` : la partition dominante (poids = h² × dirMult × periodMult, porte secondaire en smoothstep 0.2-0.4m) est calculée UNE fois par heure dans realFetch (cache `hour.dom` + `hour.faceFt`) et lue partout via getDominant/faceFtOf. AUCUN lecteur ne pioche `h.swellHeight` direct.
  - `scoreV2(...)` : multiplicatif baseSize(hauteur effective) × period × wind × dir × tide (clamp 0.40-1.35) × gustMult × chopMult (rampes, hors clamp). Le score est le BLEND des deux partitions autour du point de bascule (continuité). Période manquante = multiplicateur 1.00 exact. Caps sécurité en rampes (micro-swell 0.35-0.65m, onshore 28-42 km/h, cross 43-57 km/h). `lookupTideMult` est en rampe continue (TIDE_DELTA_NODES, nœuds aux centres des anciennes bandes) — c'était la dernière table à paliers.
  - `windClass(deltaDeg)` : classification offshore/cross/onshore UNIQUE (les 4 copies ont été fusionnées) ; null si delta inconnu → neutre explicite côté appelant.
  - `tideNotes(h, spot, tideCtx)` : générateur de notes minimal (tags marée) — scoreSurf (ancien additif mort) a été supprimé.
  - `USER_LEVEL_ZONES` : matrice min/sweetLo/sweetHi/upperMax par niveau (6 niveaux)
  - `classifyConditions(level, h, spot)` → `{ size, wind, reefTooMuch, faceFt, currentHazard }`. currentHazard couvre first_timer/beginner/**early_int** (seuils 0.28/0.56 m/s — `currentVel` est normalisé en m/s par `currentVelToMs` dans realFetch d'après `hourly_units` de la réponse API, l'API peut servir des km/h). Verdict too_big : plafond absolu `faceFt > upperMax × 1.3` (7.8 ft) → no pour early_int/intermediate, appliqué AUSSI dans la branche inside-reform (skill cas D : 9.2 ft = SKIP early_int).
  - `hasInsideReform(level, faceFt, spot)` : éligibilité fallback whitewash
  - `getPersonalVerdict(level, h, spot)` → `"yes" | "ok" | "no"` — **SOURCE DE VÉRITÉ pour le label perso**
  - `getPersonalAdviceKey(level, h, spot, displayedVerdict)` : retourne tip key matching le verdict (4e param explicite, jamais re-dériver depuis le score)
  - `getPersonalModifier(level, h, spot)` : modifier optionnel
  - `scoreForLevel(h, spot, level, tideCtx)` : score level-adjusted, plafond verdict-aware (≤38 SKIP, ≤70 MAYBE)
  - `adaptForecastToLevel(payload, level, spot)` : recompute tous les `hour.score` quand le user change de niveau
  - `getBoardRec(level, faceFt, period, spot)` : reco planche
  - `levelMatrixFor(hour, spot, fns)` : verdict par niveau (LevelMatrix)
- `verdict.js` — `SCORE_SCALE` (skip 0-14, poor 15-29, fair 30-44, good 45-59, excellent 60-74, unreal 75-100). `LEVEL_TO_MATRIX_IDX` mappe sur les **5 lignes** de levelMatrixFor (int=2, adv=3, exp=4).
- `realFetch.js` — fetch Open-Meteo + reshape, calcule `faceFtLow`/`faceFtHigh` pour display. `faceFtLow` peut valoir 0 (display "0-1 ft" honnête).

### Fichiers UI clés (`app/v2/components/`)

- `MainScreen.jsx` (~850 lignes) — orchestrateur principal
  - `personalReason` useMemo : `pv` ← `getPersonalVerdict`, passé à `getPersonalAdviceKey`
  - `danger` useMemo : bandeau `.danger-banner` inline (learner + verdict no + hazard physique) — il n'y a PAS de composant DangerBanner.jsx séparé
  - `currentHour` calculé dans le **fuseau du spot** (Intl + effectiveSpot.timezone), pas le device
  - **Lancement cache-first (SWR)** : seed avec le dernier payload LIVE (localStorage `surf-forecast-cache-<spotId>`, 24h max, re-étiqueté par date via `rehydrateCachedPayload`) → vraies données en ~1s, remplacées en silence par le fetch frais. Sans cache : seed mock en dataSource "loading" (bannière neutre, pas rouge) et le splash reste jusqu'au settle du premier fetch. Bannière ROUGE = uniquement échec sans cache ; échec avec cache = bannière douce `cached_banner`.
  - `window.__appReady = true` : au seed CACHE (vraies données à l'écran) OU au settle du premier fetch — jamais sur le mock nu. Kill-switch layout.js 20s > timeout fetch 15s ; plafond du poller splash 16s.
  - fetch avec AbortController (timeout 15s annule vraiment) ; badge "UPDATED X AGO" dérivé de lastFetchAt (l'âge du cache est honnête, format M puis H)
  - resync jour par `dateStr` via `pickedDateRef` au swap de payload
  - analytics spot gardées par `spotEffectRanRef`/`restoredSpotRef` (pas de tracking au mount/restore)
- `HourlyList.jsx` — Cards mode + List mode. Props `isToday`/`isPastDay` conditionnent le dimming "past". PAS de `key={level}` (reset le viewMode).
- `ScoreSheet.jsx` — modale "How this score is built", **portalée sur `document.body`** → sort du `.v2-stage` → besoin de `:root[data-theme]`
- `LevelMatrix.jsx` — verdict par niveau en bas, GO/MAYBE/SKIP, utilise `getPersonalVerdict` directement
- `PwaInstallPrompt.jsx` — bannière install
- `v2.css` (~2000+ lignes) — tous les styles v2 + **5 thèmes** (terracotta, burgundy, nocturnal, oceanic, forest — "sand" n'existe pas)
- ⚠️ CSS : `.wrap.hly-cardmode-active` et `.wrap:has(.hly--list-mode)` cachent StickyInfoBar/.C, DrivingChips/.drv et BestWindow/.best dans les DEUX modes → ces 3 features sont invisibles en prod. Décision produit en attente (réintégrer ou supprimer).

### Lib (`app/lib/`)
- `versionCheck.js` — heartbeat 20s, force reload sur deploy. `visibilitychange` déclenche check sans seuil.
- `analytics.js` — wrapper PostHog + Clarity (no-op si scripts pas chargés)

### Cache-bust auto-update
- `next.config.mjs` : header `cache-control: no-store` sur `/version.json`
- `versionCheck.js` : poll 20s + cache-buster `?t=` + `visibilitychange`

---

## DÉCISIONS À NE PAS DÉFAIRE

⚠️ **Score honnête, pas de floor artificiel**
Première itération avait floor=39 pour MAYBE → tuait la résolution. Conserver SEULEMENT le ceiling (≤38 SKIP, ≤70 MAYBE).

⚠️ **Label perso = `getPersonalVerdict()` direct, jamais dérivé du score**
Score et label sont 2 dimensions distinctes. "Poor 31 + MAYBE" pour un early_int sur small clean = correct. Ne pas re-coupler.

⚠️ **`getPersonalAdviceKey` reçoit le verdict en param explicite**
Toujours passer `pv` depuis MainScreen. Évite le drift si quelqu'un modifie un seul des deux chemins.

⚠️ **ScoreSheet portalé → `:root[data-theme]` est OBLIGATOIRE**
Sinon le sheet hérite des vars sand par défaut (deep teal #1a3d3a) et devient invisible en nocturnal.

⚠️ **Header `cache-control: no-store` sur `/version.json`**
Le heartbeat cache-bust avec `?t=`, mais le header est la ceinture-bretelle au cas où le CDN ignore le query string.

⚠️ **CSS inline de layout.js : `dangerouslySetInnerHTML` OBLIGATOIRE**
Un enfant texte de `<style>` est échappé par React côté serveur (`'Geist'` → `&#x27;`) alors que le navigateur parse le raw text → mismatch d'hydratation garanti → React jetait TOUT le HTML serveur à chaque load (#425/#418/#423). Ne jamais revenir à `<style>{`...`}</style>`, et pas de `<tag>` dans les commentaires CSS.

⚠️ **Typography : axe SOFT n'existe pas sur Bricolage Grotesque**
Tous les `font-variation-settings: "SOFT" X, "opsz" Y` ont été cleanés → `"opsz" 96` seulement. Si réintroduit par accident : silencieusement ignoré.

⚠️ **Nocturnal theme override `!important` sur 6 sélecteurs** (cards mode + list mode parité) pour forcer cream brillant `#f5efe0`. Cherche `v2-stage[data-theme="nocturnal"] .hly-cp-face-conv` dans `v2.css`.

⚠️ **Inside-reform branch learner — currents + blown wind = SKIP**
`getPersonalVerdict` `hasInsideReform` :
- `currentHazard === "strong"` → return "no" UNIQUEMENT pour first_timer/beginner (vrais foamie). Pour early_int (mid-length, vrai paddle) le palier bas "strong" plafonne à MAYBE, PAS un SKIP dur — sinon un courant modélisé bruité qui franchit 0.28 faisait basculer une matinée clean de 100 GO à 38 SKIP rouge (bug terrain 2026-07). Le palier haut `dangerous` (0.56) reste un `no` dur pour TOUS.
- `wind === "blown"` → return "no"
- `size === "too_small" && level === "early_int"` → return "no"
Tip selector : `currentHazard !== "none"` pour learner en SKIP → `tip_<level>_current` (rip = info safety prioritaire). early_int en MAYBE sur "strong" : le caveat courant vit dans getSessionNotes ("noticeable current, surf between flags"), pas dans le tip SKIP.

---

## RÈGLES DE TRAVAIL

### Process strict
1. Édite le code
2. `npm test` (obligatoire si scoring touché) puis `npm run build` pour vérifier
3. `public/version.json` est gitignoré (build artifact, régénéré par gen-version) — plus de `git restore` nécessaire
4. `git add` les fichiers spécifiques (pas `-A`)
5. Commit avec body clair sur le POURQUOI
6. Push : `git push origin main` ; si 403 → `git push origin main:claude/resume-session-2pbVi`
7. **Auto-merge obligatoire** après chaque push sur `claude/resume-session-2pbVi` :
   - Créer PR : `gh pr create --fill --base main --head claude/resume-session-2pbVi` (ou MCP `create_pull_request`)
   - Merger : `gh pr merge --auto --merge` (ou MCP `merge_pull_request`)
   - Ne JAMAIS demander à Louis de merger manuellement.
8. Pull `origin/main` après le merge pour aligner le local.

### Style commit
Préfixes : `fix:` `feat:` `perf:` `ux:` `sec:` `chore:` `verdict:` `scoring:` `ui:` `pwa:` `auto-update:` `typography:`
Body explique le POURQUOI, pas le quoi.

### Communication avec Louis
- Français, direct, concret
- Pas d'em-dashes excessifs (signalé explicitement)
- Pas de blabla, va au point
- Montre les diffs avant push si possible
- Explique le POURQUOI avant le QUOI
- Carte blanche : ne pas demander pour des micro-décisions, mais 2 lignes de plan avant de toucher au scoring

### Skills disponibles
- `.claude/skills/surf-app-audit/SKILL.md` — audit profond (rapport BLOQUANT/CALCUL/DEGRADE/UX/PERF)
- `.claude/skills/surf-sprint-prompt/SKILL.md` — sprint audit + génération prompts de fix

---

## ÉTAT ACTUEL (mis à jour au sprint réparation 2026-07, cf. AUDIT-PLATFORM-2026-07.md)

- Tracking PostHog complet + Session Replay actif (events spot/custom gardés contre l'inflation au mount)
- Auto-update 20s + visibilitychange ; kill-switch layout.js à 20s, `__appReady` posé dès le seed mock
- Cohérence score/label/tip à 100% (single source = `getPersonalVerdict`, partition dominante partagée score↔verdict↔display)
- scoreV2 : + gustMult/chopMult (hors clamp) + houle secondaire (blend bi-partition) + atténuation par spot + 100% continu (sprint fixes-calculs 2026-07)
- Face height : rampe continue 0.4-0.8m sur hauteur atténuée, honest sous 0.4m, `faceFtLow` peut être 0
- Timezone : currentHour/Today/dimming/axe marée/sunrise-sunset tous en heure SPOT
- Lancement : cache-first SWR (dernières vraies données instantanées) ; splash-jusqu'aux-données sinon ; plus jamais de mock+bannière rouge pendant un simple chargement (c'était vécu comme "l'app est cassée")
- Mock : dates générées du jour, banner traduit (12 langues), badge UPDATED masqué, scores mock jamais présentés comme frais — n'apparaît qu'après échec réel sans cache
- DangerBanner learners re-porté (inline MainScreen + `.danger-banner` CSS)
- Notifications locales via `registration.showNotification` (Android/iOS PWA ok)
- SEO : metadataBase + OG/Twitter + robots.txt + sitemap.xml + redirect /v2→/ + headers sécurité
- Tests vitest : `tests/scoring.test.mjs` (52 cas) — invariants verdict/ceilings/grille/NaN + continuité + dominante + sécurité
- `early_int` zone min : 1.5 ft ; `early_int + too_small` → SKIP

### Bugs identifiés non fixés
- `early_int` sur reef break avec 3-4ft clean retourne GO. Louis : "il sait ce qu'il fait, on garde" — DON'T FIX sauf demande explicite.
- ~60 strings UI hardcodées EN (panneaux Hourly, chips, LevelMatrix reasons, ScoreSheet notes, session notes) → fallback EN dans 11 langues. Les clés safety (danger_banner, footer_disclaimer, mock_banner) SONT traduites partout. Batch i18n restant : voir audit §7.
- StickyInfoBar / DrivingChips / BestWindow cachés par CSS dans les 2 modes (décision produit en attente).
- surfer.mp4 5.3 MB à ré-encoder (~1.5 MB) — pas de ffmpeg dans l'env de session.

### Niveau / spots / langues
- 6 niveaux : `first_timer`, `beginner`, `early_int`, `intermediate`, `advanced`, `expert`
- Spot par défaut : Trigg Beach (Perth, WA, beach break)
- 12 langues : en, fr, es, pt, de, it, nl, ja, id, ru, zh, ko (EN+FR ont les tips spécifiques par niveau)
- Verdict colors : `yes` = `#16a34a` vert, `ok` = `#ea580c` orange, `no` = `#dc2626` rouge

---

Fin du fichier CLAUDE.md.
