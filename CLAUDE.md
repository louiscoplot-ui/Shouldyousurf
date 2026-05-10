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

- Next.js 14.2.15 + React 18.3.1 (App Router)
- styled-jsx
- APIs : Open-Meteo Marine (ECMWF) + Forecast (GFS/ICON) + Archive (ERA5) — gratuit, no key
- Analytics : PostHog US Cloud + Session Replay (`NEXT_PUBLIC_POSTHOG_KEY`)
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
- `/` (`app/page.js`) : version v1 historique, owns le theme state au global
- `/v2` (`app/v2/page.js`) : version utilisée en prod, MainScreen + co

### Thème — appliqué EN 2 ENDROITS (obligatoire)
- `.v2-stage[data-theme="..."]` (wrapper React)
- `:root[data-theme="..."]` (documentElement, pour les portals comme ScoreSheet qui sortent de `.v2-stage`)

Si tu ajoutes un nouveau bloc theme, mets-le aux DEUX endroits.

### Fichiers clés scoring (`app/v2/lib/`)

- `prodScoring.js` — toute la logique métier surf
  - `estimateFaceHeight(swell, period)` : conversion swell → face avec period boost. **Skip le boost si swellHeight < 0.5m** (sinon 0.3m × 13s donne 1.3m de face fictive)
  - `scoreSurf(h, spot, tideCtx)` : score baseline 0-100 (continu, pas par niveau)
  - `USER_LEVEL_ZONES` : matrice min/sweetLo/sweetHi/upperMax par niveau (6 niveaux)
  - `classifyConditions(level, h, spot)` → `{ size, wind, reefTooMuch, faceFt, currentHazard }`
  - `hasInsideReform(level, faceFt, spot)` : éligibilité fallback whitewash
  - `getPersonalVerdict(level, h, spot)` → `"yes" | "ok" | "no"` — **SOURCE DE VÉRITÉ pour le label perso**
  - `getPersonalAdviceKey(level, h, spot, displayedVerdict)` : retourne tip key matching le verdict (4e param explicite, jamais re-dériver depuis le score)
  - `getPersonalModifier(level, h, spot)` : modifier optionnel
  - `scoreForLevel(h, spot, level, tideCtx)` : score level-adjusted, plafond verdict-aware (≤38 SKIP, ≤70 MAYBE)
  - `adaptForecastToLevel(payload, level, spot)` : recompute tous les `hour.score` quand le user change de niveau
  - `getBoardRec(level, faceFt, period, spot)` : reco planche
  - `levelMatrixFor(hour, spot, fns)` : verdict par niveau (LevelMatrix)
- `verdict.js` — `SCORE_SCALE` (skip 0-14, poor 15-34, fair 35-44, good 45-54, excellent 55-74, unreal 75-100)
- `realFetch.js` — fetch Open-Meteo + reshape, calcule `faceFtLow`/`faceFtHigh` pour display. `faceFtLow` peut valoir 0 (display "0-1 ft" honnête).

### Fichiers UI clés (`app/v2/components/`)

- `MainScreen.jsx` (~750 lignes) — orchestrateur principal
  - `personalReason` useMemo (~ligne 438) : `pv` ← `getPersonalVerdict`, passé à `getPersonalAdviceKey`
  - `danger` useMemo (~ligne 498) : DangerBanner pour learners SKIP
  - PWA banner timing (~ligne 140)
  - `startVersionCheck()` au mount
- `HourlyList.jsx` — Cards mode + List mode, expand panels (sub band line retirée des 2 modes)
- `ScoreSheet.jsx` — modale "How this score is built", **portalée sur `document.body`** → sort du `.v2-stage` → besoin de `:root[data-theme]`
- `LevelMatrix.jsx` — verdict par niveau en bas, GO/MAYBE/SKIP, utilise `getPersonalVerdict` directement
- `PwaInstallPrompt.jsx` — bannière install
- `DangerBanner.jsx` — bandeau safety learners
- `v2.css` (~1900+ lignes) — tous les styles v2 + 6 thèmes (terracotta, burgundy, nocturnal, oceanic, forest, sand)

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

⚠️ **Typography : axe SOFT n'existe pas sur Bricolage Grotesque**
Tous les `font-variation-settings: "SOFT" X, "opsz" Y` ont été cleanés → `"opsz" 96` seulement. Si réintroduit par accident : silencieusement ignoré.

⚠️ **Nocturnal theme override `!important` sur 6 sélecteurs** (cards mode + list mode parité) pour forcer cream brillant `#f5efe0`. Cherche `v2-stage[data-theme="nocturnal"] .hly-cp-face-conv` dans `v2.css`.

⚠️ **Inside-reform branch learner — currents + blown wind = SKIP**
`getPersonalVerdict` `hasInsideReform` :
- `currentHazard === "strong"` → return "no"
- `wind === "blown"` → return "no"
- `size === "too_small" && level === "early_int"` → return "no"
Tip selector : `currentHazard !== "none"` pour learner → `tip_<level>_current` (rip = info safety prioritaire).

---

## RÈGLES DE TRAVAIL

### Process strict
1. Édite le code
2. `npm run build` pour vérifier
3. `git restore public/version.json` AVANT add (le hook `gen-version` touche ce fichier — build artifact)
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

## ÉTAT ACTUEL (au moment de l'écriture de ce fichier)

- `main` HEAD : `b734bb6` (PR #1 mergée)
- Tracking PostHog complet + Session Replay actif
- Auto-update 20s + visibilitychange
- Cohérence score/label/tip à 100% (single source = `getPersonalVerdict`)
- Typography : Bricolage Grotesque / Geist / Geist Mono
- PWA banner : re-prompt 7j après dismiss, skip permanent uniquement si standalone
- Verdict learner inside-reform : strong current + blown wind = SKIP
- Face height : honest pour swell <0.5m, `faceFtLow` peut être 0
- `early_int` zone min : 1.5 ft
- `early_int + too_small` → SKIP

### Bugs identifiés non fixés
- `early_int` sur reef break avec 3-4ft clean retourne GO. Louis : "il sait ce qu'il fait, on garde" — DON'T FIX sauf demande explicite.
- 10 langues sur 12 n'ont pas tous les tip strings → fallback EN. Hors scope.

### Niveau / spots / langues
- 6 niveaux : `first_timer`, `beginner`, `early_int`, `intermediate`, `advanced`, `expert`
- Spot par défaut : Trigg Beach (Perth, WA, beach break)
- 12 langues : en, fr, es, pt, de, it, nl, ja, id, ru, zh, ko (EN+FR ont les tips spécifiques par niveau)
- Verdict colors : `yes` = `#16a34a` vert, `ok` = `#ea580c` orange, `no` = `#dc2626` rouge

---

Fin du fichier CLAUDE.md.
