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
  - **Point d'échantillonnage marin** (`marineSamplePoint`, realFetch) : la grille des modèles de vagues fait ~1/12° (≈9 km). Un spot sur le trait de côte tombe dans une cellule à dominante TERRESTRE = artefact de bord. Mesuré à Trigg le 01/08, même heure : cellule côtière 1.32 m / première cellule 100% eau 1.64 m (+24%) / au large du Five Fathom Bank 2.02 m (+53%). Le modèle atténuait DÉJÀ ×0.65 avant notre `swellAttenuation` 0.60 → 0.39 réel, on jetait 61% de la houle. Les requêtes MARINES partent maintenant d'un point décalé de 5 km vers le large, direction donnée par `idealSwellDir` (généralise à toute côte, sans table codée en dur). Override possible via `marineLat`/`marineLng` sur le spot.
  - **Rafale (`usableGustKmh`) : elle ne DÉCIDE rien** ⚠️ ne pas remettre la rafale dans le verdict. Deux témoignages terrain en sens OPPOSÉ ont tranché. **14/09 Trigg** : moyenne 10.3, rafale 22.3 (facteur 2.17), "ça souffle plus que l'affichage". **17/09** : moyenne 12, rafale 40 (facteur **3.33**), quelqu'un **DANS L'EAU en train de surfer** dit "pas de vent". Le second est le meilleur signal qu'on ait jamais eu, et il prouve que `wind_gusts_10m` n'est PAS un prédicteur fiable du vent subi. Une version intermédiaire mettait la rafale au cœur du verdict (`feltWindKmh` = moyenne + écart × 0.5) : sur 12/40 ça donnait 26 km/h ressentis → "blown" → **SKIP sur une session que quelqu'un faisait tranquillement**. ⚠️ **Faire rater une bonne session est une faute aussi grave que faire conduire pour rien** — les deux erreurs comptent, l'app n'a le droit ni à l'une ni à l'autre. `classifyConditions` et le plafond du verdict décident donc sur la **MOYENNE**. La rafale ne sert plus qu'à pénaliser doucement le score (`gustMult`).
    Facteurs de rafale réels : 1.2-1.4 en mer, 1.3-1.6 au bord, ~1.8 en air instable, 2+ = grain (pas une journée de surf). D'où `GUST_CONFIDENCE_NODES` : crédible ≤ 1.8, poids qui fond linéairement jusqu'à 2.6, ignorée au-delà. ⚠️ **C'est une RAMPE, pas un seuil** — un couperet net à 2.0 a été écrit puis rejeté par le test de continuité (saut de 10 points au franchissement). Même règle que partout dans ce moteur : aucun palier dur.
  - ✅ **Rafale : CALIBRÉE sur 179 observations BoM réelles** (station 94615, 15-17/09/2026) — médiane **1.54**, 90e pct **1.76**, 99e pct **2.00**, **max 2.71**. 89 % des relevés sont sous 1.8. `GUST_CONFIDENCE_NODES = [[1.8, 1], [2.6, 0]]` tombe donc pile sur le 90e percentile et sur le maximum observé : ce ne sont plus des valeurs de confort, elles viennent des données. Pour les bouger il faut d'AUTRES mesures. Le modèle Open-Meteo a servi **3.33** le 17/09, au-dessus du maximum jamais mesuré → le filtre écarte une valeur hors-domaine physique, il ne "corrige" pas au jugé. ⚠️ Station de COLLINES (rugosité forte) donc facteurs majorés par rapport au littoral : ces bornes sont prudentes pour un spot côtier, une station littorale les resserrerait. ⚠️ **Ces observations ont servi à VALIDER un seuil, elles ne sont PAS une source de production** et le moteur n'en dépend pas — le facteur de rafale est une grandeur PHYSIQUE, ses bornes valent à Trigg comme à Hossegor ou Pipeline.
  - ⚠️ **NOTRE SOURCE DE VENT N'EST PAS FAUSSE** — preuve 17/09, deux sources indépendantes, même heure, même endroit : **Apple Météo 11 km/h ONO rafales 36** ("entre 5 et 20, rafales jusqu'à 40") / **Open-Meteo 12 km/h rafales 40**. Elles sont d'accord. La conclusion tentante ("le modèle sous-estime, il faut changer d'API / brancher une station") était FAUSSE, et elle a coûté plusieurs itérations. Tous les écarts remontés du terrain venaient du TRAITEMENT de la rafale, pas de la donnée. Avant de soupçonner la source, comparer à une source indépendante.
  - **Décalage du point de VENT : DÉSACTIVÉ** (`WIND_OFFSET_ENABLED = false` dans realFetch). ⚠️ Ne pas le rallumer sans refaire la mesure. Relevé réel du 14/09 pour les 4 points interrogés (plage, +4, +8, +14 km au large) : **les quatre renvoient le même centre de cellule** (-31.880493 / 115.77618) et exactement le même vent. Le centre est à 2.3 km du spot vers l'intérieur, et le point à 14 km au large est encore à 16.1 km de ce centre SANS changer de cellule — la grille servie est trop grossière pour qu'un décalage de quelques km serve à quoi que ce soit. On doublait les requêtes pour lire deux fois la même valeur. Le raisonnement physique (rugosité banlieue vs mer) reste juste, c'est la RÉSOLUTION qui le rend inopérant : la machinerie (`windSamplePoint` / `resolveSeaWind`, testée et best-effort) reste en place derrière le drapeau et se rallume en une ligne si on passe un jour à un modèle assez fin. L'écart ressenti venait de la rafale, pas du point de mesure.
  - **Sonde du cap du large (`probeOffshoreBearing`) — TOUS les spots, curés compris.** Elle sonde une couronne de 8 caps à 5 km en UNE requête (l'API accepte `latitude=a,b,c`, ✅ **confirmé sur réponse réelle 17/09**) et mesure la houle moyenne de chacun. Cache par coordonnées (`surf-marine-bearing-v2-<lat>,<lng>`) → une sonde par spot et par appareil. Best-effort strict : échec réseau, HTTP non-ok ou sonde non concluante → `null` → comportement d'avant.
  - ⚠️ **UNE CELLULE TERRESTRE N'EST PAS MASQUÉE — c'était faux, c'est mesuré.** On a écrit et poussé « les cellules à terre sont masquées/quasi vides » sans jamais le vérifier. Sonde réelle Trigg du 17/09 : les 4 caps qui pointent vers Perth (`elevation` **22, 12, 14 et 18 m**) rendent une série **complète de 24 valeurs de houle plausibles** (0.52-0.68 m). L'ancien garde-fou `série trop courte = terre` ne se déclenchait donc **jamais**. Ça marchait quand même à Trigg parce que la cellule terrestre rend par chance MOINS de houle que le large (0.60 vs 0.74) — de la chance, pas de la logique.
    Le vrai discriminant était dans la réponse depuis le début : **`elevation`, et c'est l'altitude du point DEMANDÉ, pas de la cellule servie.** Preuve à Ichinomiya : les caps 225/270/315 rendent `elevation` 17, 43 et 3 m tout en étant servis par la MÊME cellule que les caps marins. Sur l'eau, `elevation` vaut 0. Exact, gratuit, mondial. `pickProbedBearing` écarte donc tout cap d'`elevation > 0`, avec repli sur le classement par houle seule si TOUS les caps sont à terre.
  - ✅ **Résolution de la grille MARINE : mesurée, et elle résout.** Contrairement au vent (4 points → 1 seule cellule, d'où `WIND_OFFSET_ENABLED = false`), la couronne marine à 5 km rend **3 cellules distinctes sur 8 à Trigg, 2 à Ichinomiya, 5 à Cape Hatteras**. Le décalage marin a donc un sens là où le décalage du vent n'en avait aucun. Ne pas confondre les deux dossiers.
    - **Spots PERSONNALISÉS** (recherche libre / carte / GPS) : pas d'`idealSwellDir` au moment du fetch (`inferSpotProfile` ne tourne qu'APRÈS), donc ils gardaient le bug de la cellule terrestre. La sonde est **attendue** pour eux : sans elle ils n'ont aucun repli. Sert aussi de repli à `inferSpotProfile` quand il ne trouve pas assez d'heures exploitables.
    - **Spots CURÉS** : le décalage de 5 km partait dans la direction `idealSwellDir`. C'est le large sur une côte franche, un cap oblique ailleurs — écart médian mesuré entre `idealSwellDir` et le large présumé (`offshoreWindDir + 180`) sur les 111 spots : **30°, 90e pct 75°**. À 75° un décalage de 5 km ne gagne que 1.3 km vers le large : sur une grille de 9 km on reste dans la cellule côtière et le fix de Perth ne mord pas. La sonde corrige ça, mais elle **n'écrase JAMAIS `idealSwellDir`** : `pickProbedBearing` ne retient qu'un cap à **±90°** de lui (`PROBE_MAX_DEVIATION_DEG`). Sans cette contrainte, un spot au bout d'une pointe se ferait sonder de l'autre côté du cap — plein océan, mais pas SON océan. Simulation sur les 111 spots : 40 déjà alignés, **70 corrigés**, 1 hors contrainte (Noosa, 100° d'écart → garde son cap).
    - ⚠️ **La sonde n'est PAS attendue pour un spot curé** : son résultat décide des coordonnées de la requête principale, donc elle la bloquerait. Un spot curé a un repli valable (`idealSwellDir`), donc la sonde part en parallèle et mord au chargement SUIVANT. **Premier lancement = exactement l'app d'avant, à la milliseconde près.** Ne pas la remettre dans le chemin bloquant.
    - ✅ **`PROBE_MIN_GAIN` = 1.02, calé sur des gains MESURÉS.** Sonde réelle du 17/09 : un changement de cap vaut **+4.6 % à Ichinomiya** (135 → 180) et **+11.3 % à Cape Hatteras** (135 → 90). Une version avait posé **1.15 « par prudence »** : les DEUX seraient tombés dessous, donc le seuil aurait annulé la correction sur les deux spots obliques qu'elle devait justement réparer (et sur 57 des 111 en simulation). **Un seuil de confort qui désactive la feature en silence n'est pas une précaution.** `PROBE_MIN_GAIN` ne sert plus qu'à ne pas basculer entre deux caps tombant dans la MÊME cellule. Le garde-fou qui protège, c'est le ±90°.
    - ✅ **Trigg : la sonde rend `null` = aucun changement.** `idealSwellDir` 240 → cap 225, qui tombe déjà dans la cellule du large (0.74 vs 0.60 pour la cellule terrestre). Le fix Perth du 01/08 faisait donc déjà ce qu'il fallait, et étendre la sonde aux spots curés ne le casse pas. Verrouillé par `describe("cas terrain : sondes reelles du 17/09")` dans `tests/wind-sample.test.mjs` — **les trois sondes réelles y sont encodées telles quelles.**
  - ✅ **`swellAttenuation` : le trou est BEAUCOUP plus petit qu'on ne l'a écrit.** Ce fichier a longtemps dit « défaut 1.0 sur 107 spots = LE seul trou pour l'international », comme si ces 107 spots annonçaient la houle brute du large. **C'est faux, mesuré le 17/09** (profil de décroissance réel, 5/10/15/20/30/45 km le long du cap du large) :

    | distance | Trigg (cap 270) | Cape Hatteras (cap 90) |
    |---|---|---|
    | 5 km | 0.740 m (**0.474**) | 0.618 m (**0.717**) |
    | 10 km | 0.924 (0.592) | 0.618 (0.717) |
    | 20 km | 1.147 (0.736) | 0.756 (0.878) |
    | 45 km | 1.560 (1.000) | 0.861 (1.000) |

    **Open-Meteo applique DÉJÀ sa propre bathymétrie, spot par spot, partout.** Trigg perd 53 % entre 45 km et 5 km, Cape Hatteras seulement 28 %. Ce n'est pas nous qui atténuons : la valeur qu'on lit à 5 km est **déjà** une valeur abritée, spécifique au spot, et ça vaut pour les 111. Le défaut 1.0 n'annonce donc PAS de la houle de plein océan.
  - ⚠️ **NE JAMAIS dériver `swellAttenuation` du rapport Hs(5 km) / Hs(large).** L'idée est tentante (un coefficient d'exposition mesuré, dérivé des coordonnées, mondial — exactement la forme que la règle n°0 autorise) et elle a été proposée puis **réfutée par la mesure avant d'être codée**. Cette atténuation est **déjà dans la valeur à 5 km** : la réappliquer compterait le plateau continental deux fois. À Trigg : 0.74 × 0.474 = **0.35 m**, absurde. Le ratio DÉCRIT ce que le modèle a déjà fait, il ne dit rien de ce qu'il reste à faire.
    Ce que le ratio vaut quand même : c'est un **indicateur d'exposition** honnête et discriminant (Trigg 0.47 derrière Rottnest, Hatteras 0.72 avancé dans l'Atlantique), obtenu sans aucune donnée locale. Utilisable comme diagnostic, jamais comme multiplicateur.
  - ⚠️ **Pas de plateau à 45 km** : la houle monte encore sur les deux spots. On ne peut donc pas lire un H0 d'eau profonde à portée de sonde, et **une formule de déferlement depuis le large reste inapplicable telle quelle**. Testé le 17/09 : `Hb = 0.39·g^(1/5)·(T·H0²)^(2/5)` (Komar & Gaughan, forme vérifiée dimensionnellement) appliquée à notre lecture donne 2.93 / 4.32 / 2.63 ft sur les trois cas terrain Trigg, contre 1-3 / 2-4 / 0-2 ft observés — **deux des trois sortent de la fourchette**, parce qu'elle attend un H0 non réfracté et qu'on lui donne un Hs déjà transformé. Le `periodFactor` ad hoc est moins élégant mais il colle au terrain. Ne pas le remplacer sans résoudre ce problème d'entrée.
  - ⚠️ Ne PAS chercher à calibrer `swellAttenuation` par bouée locale : une bouée couvre un point et n'existe pas dans la plupart des 23 pays — ça ne passe pas à l'échelle, même raison que pour les stations de vent. Et pour les 4 Perth (0.55-0.60, posées au jugé) : les trois cas terrain de septembre passent avec ces valeurs, donc **on n'y touche pas sans une mesure de hauteur réelle au break.**
    Verrouillé par `describe("cas terrain : profil de decroissance du 17/09")` dans `tests/wind-sample.test.mjs`.
  - `spotAttenuation(spot)` : fraction du Hs offshore qui atteint le break (`swellAttenuation` sur le spot, défaut 1.0). Perth métro 0.55-0.60 (Five Fathom Bank / Rottnest), défaut 1.0 pour les 107 autres. Appliquée UNE fois par chemin (estimateFaceHeight / hauteur effective de scoreV2).
  - `estimateFaceHeight(swell, period, attenuation)` : conversion swell → face avec period boost en rampe continue 0.4→0.8m (smoothstep sur la hauteur ATTÉNUÉE).
  - **Windswell = partition à part entière** : `wind_wave_height/period/direction` concourent au MÊME poids que les deux houles dans `swellPartitions`. Avant, le windsea n'entrait QUE comme pénalité (chopMult) — il pouvait baisser le score, jamais grossir la vague, donc les jours de windsea dominante l'app annonçait "0-2 ft" alors qu'il y avait de quoi surfer (terrain Trigg 30/07). Sa période courte le pénalise déjà via `lookupPeriodMult` + `periodFactor` : il ne gagne que s'il porte vraiment le plus d'énergie surfable. `chopMult` est neutralisé (`!part.isWind`) quand la partition notée EST le windsea, sinon on le pénalisait contre lui-même.
  - `faceMOf(h, spot)` : la face est **FONDUE** entre les deux partitions avec le même smoothstep que le blend de `scoreV2`. Elle suivait un argmax sec (`pickDominantSwell`) : au basculement elle sautait (5.91 → 4.20 ft pour 1 cm de windsea, propagé jusqu'au verdict et au score, 36 pts). `pickDominantSwell` reste l'argmax mais ne sert plus qu'à NOMMER la partition affichée (ligne SWELL). `faceFtOf` lit le cache `hour.faceFt` puis retombe sur `faceMOf`.
  - `swellPartitions(h, spot)` / `pickDominantSwell` / `getDominant(h, spot)` / `faceFtOf(h, spot)` : la partition dominante (poids = h² × dirMult × periodMult, porte secondaire en smoothstep 0.2-0.4m) est calculée UNE fois par heure dans realFetch (cache `hour.dom` + `hour.faceFt`) et lue partout via getDominant/faceFtOf.
  - ⚠️ **`shapeHour` ne RÉÉCRIT PAS `swellHeight`** — il fait `...raw` et ajoute `dom` à côté. `h.swellHeight` reste donc la partition PRIMAIRE d'Open-Meteo, et c'est VOULU : `adaptForecastToLevel` re-score depuis l'heure mise en forme, donc écraser `swellHeight` par la dominante corromprait le re-scoring au changement de niveau. **Ne pas "simplifier" ça.**
    Conséquence à ne jamais reperdre : **tout lecteur d'AFFICHAGE doit passer par `dom`**, jamais par `h.swellHeight`. Ce fichier a longtemps affirmé « AUCUN lecteur ne pioche `h.swellHeight` direct » — **c'était faux pour toute la couche d'affichage** : `HourlyList` le lisait aux 5 endroits où la houle apparaît, plus `BestWindow`. Les jours de windswell dominante, l'écran montrait donc **« 1-3 ft » à côté de « 0.3 m · 5 s »** : la face venait du windswell de 1.30 m, la ligne SWELL de la primaire de 0.35 m. Deux vagues différentes collées l'une à l'autre, sur la ligne que l'utilisateur lit pour décider. Corrigé via le helper `domOf()` de `HourlyList` (repli sur la primaire si un vieux payload ne porte pas `dom`) et le même repli dans `BestWindow`. Verrouillé par `describe("ligne SWELL affichee = partition dominante")` dans `scoring.test.mjs`.
  - `scoreV2(...)` : multiplicatif baseSize(hauteur effective) × period × wind × dir × tide (clamp 0.40-1.35) × gustMult × chopMult (rampes, hors clamp). Le score est le BLEND des deux partitions autour du point de bascule (continuité). Période manquante = multiplicateur 1.00 exact. Caps sécurité en rampes (micro-swell PAR NIVEAU via MICRO_CAP_NODES — first_timer libéré dès 0.30m, beginner 0.50m, autres 0.65m ; onshore 28-42 km/h, cross 43-57 km/h). Le cap micro universel écrasait le peak first_timer (0.3m → 12/100 rouge + verdict GO) : son jour d'apprentissage idéal était illisible. `lookupTideMult` est en rampe continue (TIDE_DELTA_NODES, nœuds aux centres des anciennes bandes) — c'était la dernière table à paliers.
  - `windClass(deltaDeg)` : classification offshore/cross/onshore UNIQUE (les 4 copies ont été fusionnées) ; null si delta inconnu → neutre explicite côté appelant.
  - `tideNotes(h, spot, tideCtx)` : générateur de notes minimal (tags marée) — scoreSurf (ancien additif mort) a été supprimé.
  - `USER_LEVEL_ZONES` : matrice min/sweetLo/sweetHi/upperMax par niveau (6 niveaux)
  - `classifyConditions(level, h, spot)` → `{ size, wind, reefTooMuch, faceFt, currentHazard }`. currentHazard couvre first_timer/beginner/**early_int** (seuils 0.28/0.56 m/s — `currentVel` est normalisé en m/s par `currentVelToMs` dans realFetch d'après `hourly_units` de la réponse API, l'API peut servir des km/h). Verdict too_big : plafond absolu `faceFt > upperMax × 1.3` → no, pour TOUS les niveaux, appliqué AUSSI dans la branche inside-reform (first_timer 2.9 ft, beginner 3.9 ft, early_int/intermediate 7.8 ft).
  - `LEARNER_WIND_CAP` : plafond de vent PAR NIVEAU et PAR DIRECTION pour first_timer / beginner / early_int (**16-21 / 20-25 / 24-29** km/h, `other` = cross ET onshore, `offshore` = +5). **SOURCE UNIQUE** du label `wind` de `classifyConditions` ET du plafond de la branche inside-reform de `getPersonalVerdict` — ne JAMAIS recopier un seuil en dur d'un côté. Avant, le seuil learner ne serrait que l'onshore (18) ; le cross partageait le 30 de tout le monde et l'offshore "clean" courait jusqu'à 25 quel que soit le niveau. Cas terrain Trigg 14/09 : beginner, 2.8 ft, SE cross → "Good 47 · WORTH IT" jusqu'à **24 km/h inclus**, bascule en SKIP seulement à 25. Louis a conduit pour ça. ⚠️ **Le but de l'app est d'éviter le trajet, pas de le valider** : en cas de doute sur un seuil learner, on resserre. L'échelle DOIT rester monotone (first_timer ≤ beginner ≤ early_int) — c'est pour ça que first_timer descend quand beginner descend. intermediate+ ne sont PAS dans la table (logique générale + `galeKills`). Repères de surface : <8 glassy, 8-15 léger, 15-20 texturé, 20+ haché.
    ⚠️ **UN PLAFOND NE SE JUGE PAS SUR LE VERDICT SEUL, MAIS SUR LE SCORE AFFICHÉ.** `flipProximity` fait glisser le score vers la bande suivante **~4 km/h AVANT** la bascule (c'est voulu, ça évite une falaise). Donc baisser un plafond n'écrase pas seulement le point de SKIP : ça dévalue tout le score en amont. Cas 17/09 : une beginner a fait une session qu'elle a jugée **excellente** (0.7 m/11 s, 13 km/h NW onshore) ; le verdict était correct (WORTH IT) mais le score tombait à **35 Fair avec des barres orangées** — « si elle avait checké l'app elle ne serait jamais venue ». Plafond 15 → 12km:43 13km:35 14km:27. Plafond 20 → 12km:47 13km:46 14km:46. Les plafonds sont donc remontés à 16/20/24, seule plage qui satisfait les DEUX cas terrain (session du 17/09 ouverte et engageante, trajet du 14/09 à 20+ en SKIP).
    ⚠️ **Un verdict juste ne suffit pas si le nombre à côté décourage.** Personne ne se déplace en voyant du rouge.
  - `hasInsideReform(level, faceFt, spot)` : éligibilité fallback whitewash — plafond PAR NIVEAU (`REFORM_MAX_FT` : first_timer 6 ft, beginner 8 ft, early_int 10 ft). ⚠️ Ce plafond n'est PLUS le garde-fou principal : le verdict applique en plus `upperMax × 1.3` DANS la branche reform pour tous les niveaux (cf. ci-dessus), ce qui coupe bien avant (beginner 3.9 ft, pas 8). REFORM_MAX_FT ne gouverne plus que getBoardRec / getSessionNotes.
  - `getPersonalVerdict(level, h, spot)` → `"yes" | "ok" | "no"` — **SOURCE DE VÉRITÉ pour le label perso**
  - `getPersonalAdviceKey(level, h, spot, displayedVerdict)` : retourne tip key matching le verdict (4e param explicite, jamais re-dériver depuis le score)
  - `getPersonalModifier(level, h, spot)` : modifier optionnel
  - `scoreForLevel(h, spot, level, tideCtx)` : score level-adjusted, plafond verdict-aware (≤29 SKIP, ≤59 MAYBE — calés sur les bornes de SCORE_SCALE) rendu CONTINU par `flipProximity` : la proximité d'une bascule de bande est mesurée en sondant `getPersonalVerdict` sur des copies perturbées de l'heure (bisection sur 6 axes bruités : vent ±4 km/h, courant ±0.08 m/s, houle ±12% — windswell inclus, sinon le lisseur est aveugle les jours de windsea dominante —, plus 2 axes COMBINÉS vent+houle ; la bande cible est lue AU POINT DE BASCULE et le score glisse séquentiellement bande par bande) et le score glisse vers le mapping de la bande suivante (BAND_MAPS) AVANT la bascule → zéro saut au moment où le label change. Ne JAMAIS re-dupliquer les seuils du verdict dans une table à côté : le probing suit automatiquement toute évolution des règles.
  - `adaptForecastToLevel(payload, level, spot)` : recompute tous les `hour.score` quand le user change de niveau
  - `getBoardRec(level, faceFt, period, spot)` : reco planche
  - `levelMatrixFor(hour, spot, fns)` : verdict par niveau (LevelMatrix)
- `verdict.js` — `SCORE_SCALE` (skip 0-14, poor 15-29, fair 30-44, good 45-59, excellent 60-74, unreal 75-100). `LEVEL_TO_MATRIX_IDX` mappe sur les **5 lignes** de levelMatrixFor (int=2, adv=3, exp=4).
- `realFetch.js` — fetch Open-Meteo + reshape, calcule `faceFtLow`/`faceFtHigh` pour display. `faceFtLow` peut valoir 0 (display "0-1 ft" honnête).

### Fichiers UI clés (`app/v2/components/`)

- `MainScreen.jsx` (~850 lignes) — orchestrateur principal
  - `personalReason` useMemo : `pv` ← `getPersonalVerdict`, passé à `getPersonalAdviceKey`
  - `danger` useMemo : bandeau `.danger-banner` inline (learner + verdict no + hazard **PHYSIQUE**) — il n'y a PAS de composant DangerBanner.jsx séparé. ⚠️ Le vent SEUL ne déclenche pas le bandeau : `wind === "blown"` ne compte que si la taille n'est ni `too_small` ni `small`. Terrain 17/09 : bandeau rouge "Dangerous conditions" sur **0-2 ft**, des vagues minuscules. Du vent qui hache un pied de vague n'est pas dangereux, c'est mauvais — et le verdict SKIP le dit déjà. Crier au danger sur une journée inoffensive use l'alerte : le jour où elle sort sur un vrai rip, elle ne sera plus lue.
  - `currentHour` calculé dans le **fuseau du spot** (Intl + effectiveSpot.timezone), pas le device
  - **Lancement cache-first (SWR)** : seed avec le dernier payload LIVE (localStorage `surf-forecast-cache-<spotId>`, 24h max, re-étiqueté par date via `rehydrateCachedPayload`) → vraies données en ~1s, remplacées en silence par le fetch frais. Sans cache : seed mock en dataSource "loading" (bannière neutre, pas rouge) et le splash reste jusqu'au settle du premier fetch. Bannière ROUGE = uniquement échec sans cache ; échec avec cache = bannière douce `cached_banner`.
  - `window.__appReady = true` : au seed CACHE (vraies données à l'écran) OU au settle du premier fetch — jamais sur le mock nu. Kill-switch layout.js 20s > timeout fetch 15s ; plafond du poller splash 16s.
  - fetch avec AbortController (timeout 15s annule vraiment) ; badge "UPDATED X AGO" dérivé de lastFetchAt (l'âge du cache est honnête, format M puis H)
  - resync jour par `dateStr` via `pickedDateRef` au swap de payload
  - analytics spot gardées par `spotEffectRanRef`/`restoredSpotRef` (pas de tracking au mount/restore)
- `HourlyList.jsx` — Cards mode + List mode. Props `isToday`/`isPastDay` conditionnent le dimming "past". PAS de `key={level}` (reset le viewMode). **Le vent affiché = LE VENT MOYEN, un seul chiffre** (`windLabel`). ⚠️ Ne pas remettre de fourchette ni de note "gusts" à côté. La fourchette `10–40` a été essayée et retirée sur retour terrain direct : *"on voit bien que le vent est à 10 km/h mais de temps en temps rafale, ça fausse tout, on a besoin juste du vent global"*. Un facteur 3.3 décrit quelques bourrasques isolées dans une heure de calme ; l'afficher à côté de la moyenne pousse à lire le gros chiffre et à renoncer à une bonne session. Utilisé aux TROIS endroits où le vent apparaît (panneau cards, ligne liste, ligne dépliée) — sinon les vues se contredisent. Pourquoi : `windGustKn` était fetché depuis toujours mais ne vivait que dans StickyInfoBar, cachée par CSS dans les 2 modes → invisible en prod. Un soir à 10 de moyenne avec des bourrasques à 22, personne sur la plage ne reconnaît "10 km/h", et c'est l'app qui a tort. Une note discrète à côté (`G23`) ne suffisait pas : illisible, et ça présentait encore la moyenne comme LA valeur. ⚠️ Ne pas revenir à un chiffre unique.
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
Première itération avait floor=39 pour MAYBE → tuait la résolution. Conserver SEULEMENT le ceiling (≤29 SKIP, ≤59 MAYBE).

⚠️ **Les plafonds de bande sont CALÉS SUR LES LIBELLÉS de `SCORE_SCALE`, pas sur des nombres ronds**
MAYBE ≤ 59 = haut de "Good" ; SKIP ≤ 29 = haut de "Poor". Avant : MAYBE plafonnait à 70 alors que "excellent" démarre à 60 → un MAYBE s'affichait **"Excellent"** en gros vert pendant que le conseil dessous disait "the main break isn't for you today — too big". Une beginner a conduit 40 min et s'est retrouvée dans des conditions au-dessus de sa tête : elle a lu le titre, pas le conseil. Si tu touches à `SCORE_SCALE`, re-cale `BAND_MAPS` dans la foulée — le test "un verdict ne peut jamais être contredit par le libellé du score" échouera sinon.

⚠️ **L'inverse (score bas + verdict optimiste) est VOULU, ne pas le "corriger" avec un floor**
"Poor 26 + GO" pour un first_timer sur 0.8 ft clean = correct : les conditions sont objectivement mauvaises, la session reste bonne pour LUI. Seul le sens dangereux (libellé flatteur sur un verdict prudent) est un bug.

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

### ⚠️ L'APP EST MONDIALE — règle n°0

**111 spots, 23 pays** (AU ID FR PT ES US MX CR BR NZ PF ZA MA LK MV IE GB NI PE EC FJ PH JP) **plus la recherche libre sur n'importe quelle plage du monde.**

Conséquence sur toute décision technique : **rien ne doit dépendre d'un point fixe.** Une station d'observation, une bouée, une table codée en dur pour un spot, un modèle météo régional — tout ça couvre UN endroit et n'existe pas ailleurs. Cette piste a été explorée pour le vent (stations BoM) puis abandonnée : elle ne passe pas l'échelle, et elle ne répond même pas au besoin (« les bonnes conditions à chaque changement de plage, pas juste Trigg »).

Ce qui a le droit d'exister :
- **PAR SPOT, dérivé des coordonnées** : `idealSwellDir` / `offshoreWindDir` / `idealTide` (renseignés **111/111**), inférés pour un spot libre via `probeOffshoreBearing` + `inferSpotProfile`. Open-Meteo répond par coordonnées partout.
- **PHYSIQUE et universel** : facteur de rafale plausible, repères de surface, conversion houle→face. Ça vaut à Trigg comme à Pipeline.

Une observation locale sert à **valider** un seuil physique. Jamais de source de production.

### ⚠️ VÉRIFIER AVANT D'AFFIRMER — règle n°1

Quatre régressions poussées en PROD sur ce chantier vent, toutes la même faute :
**une hypothèse présentée comme un fait, jamais vérifiée.**

| affirmé | réalité |
|---|---|
| "l'API renvoie le centre de cellule, décaler le point va marcher" | les 4 points rendaient la MÊME cellule — fix inutile, quota doublé |
| "comparer les coordonnées prouve qu'on a changé de cellule" | critère faux, le fix ne mordait pas |
| "la rafale explique le ressenti, mettons-la dans le verdict" | faisait rendre SKIP sur une session en cours |
| "la station BoM la plus proche de Trigg est le WMO 94615" | c'est Gooseberry Hill, dans les collines, 35 km à l'est |

Avant d'écrire un chiffre, un identifiant, un nom de station, un endpoint ou
un comportement d'API dans du code OU dans une réponse :
1. **Est-ce que je l'ai vérifié, ou est-ce que je le déduis ?**
2. Si déduit : le DIRE explicitement ("je suppose que…, je ne peux pas le
   vérifier depuis cette session"), et ne PAS le pousser en prod comme un fait.
3. Le proxy de session bloque Open-Meteo et le BoM : **toute affirmation sur
   ces APIs est une hypothèse** tant que Louis n'a pas collé une réponse réelle.
4. Un identifiant précis (WMO, code station, route d'API) ne s'invente jamais.
   Sans source, donner la page qui les liste et dire qu'on ne peut pas vérifier.

Une vérification de 30 secondes vaut mieux qu'une journée de déduction, et
surtout mieux qu'un aller-retour de plus imposé à Louis.

### Process strict
1. Édite le code
1bis. ⚠️ **Scoring ou verdict touché → BUMPER `CACHE_V` dans realFetch.js.** Le payload en cache porte les `hour.score` / `faceFt` / `dom` DÉJÀ CALCULÉS. Sans bump, l'app resserre pendant 24 h des verdicts que le code ne produit plus. Cas terrain 17/09 : écran "SKIP · 22 Poor · DANGEROUS" + fourchette de vent, alors que le moteur déployé rendait "OK · 44 Fair" sans fourchette sur les mêmes données — les fixes étaient en prod, le cache les masquait. Verrouillé par `tests/cache.test.mjs`.
2. `npm test` (obligatoire si scoring touché), `npm run lint:undef` puis `npm run build` pour vérifier

⚠️ `npm run build` NE DÉTECTE PAS une variable supprimée mais encore utilisée dans le JSX.
Les composants v2 ne sont jamais rendus pendant la génération statique (le splash occupe
l'écran tant que `payload` est null), donc un `ReferenceError` dans StickyInfoBar/HourlyList
passe le build et ne casse qu'en prod, à l'écran de l'utilisateur — page blanche
"Application error: a client-side exception has occurred". C'est arrivé le 27/07 (variable
`faceM` retirée d'un calcul mais toujours lue dans le rendu). `npm run lint:undef` attrape
exactement ça : à lancer avant tout push touchant un composant.
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
- Tests vitest : `tests/scoring.test.mjs` (109 cas, dont 11 cas terrain) — invariants verdict/ceilings/grille/NaN + continuité + dominante + sécurité ; `tests/wind-sample.test.mjs` (43 cas) — géométrie du point vent, sélection de la cellule la plus proche qui sort vraiment de la terre, garde-fous du recollage mer/spot
- **Cas terrain verrouillés** (`describe("cas terrain Trigg")` dans scoring.test.mjs) : 11 tests sur des journées réellement vécues par Louis, qui encadrent le moteur par les DEUX bouts. **Jeudi 10/09 aprem** (5-7 km/h, 1-3 ft, "super top") → beginner doit rendre GO + score ≥ 60 : c'est le contre-exemple qui interdit de sur-resserrer, les après-midi sans vent existent. **Lundi 14/09 17h** (1.3 m/11 s, SE cross-shore, 2-4 ft, très venteux, trajet pour rien) → beginner doit rendre SKIP dès 15 km/h, et le libellé ne doit pas flatter. ⚠️ Si un de ces tests casse, ce n'est PAS le test qu'il faut ajuster : c'est que le moteur s'est remis à mentir sur une journée dont on connaît la réponse. **SAUF** si le test encodait un SEUIL INTERNE au lieu d'un fait observé — piège réel : le cas du 14/09 exigeait SKIP « dès 15 km/h » alors que le témoignage disait « au moins 20 ». Le 15 venait du plafond de l'époque, recopié dans le test, et il a bloqué une correction légitime. **Un cas terrain ne contient QUE la mesure ou le témoignage, jamais un réglage du moteur.** Ajouter un cas ici à chaque fois que Louis remonte une session du terrain.
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
