# AUDIT PLATEFORME — Should You Surf?
**Date : 2026-07-02 · HEAD audité : `1a7d31c` · Périmètre : 100 % du repo + probes numériques du moteur de scoring + données PostHog réelles + recherche sources de données 2026**

Méthode : lecture intégrale des fichiers, exécution du moteur de scoring sur des cas de contrôle (tous les chiffres cités sont mesurés, pas supposés), audit UI/infra/SEO/PWA/sécurité par passes parallèles, recherche factuelle sur les sources de données marines.

Notation de chaque recommandation : **[Prio /100 · Difficulté · Impact user · Impact revenu]**.

---

## 1. Executive summary

**Le produit a la bonne thèse et le mauvais moteur.** La promesse "GO / MAYBE / SKIP par niveau" est le meilleur angle différenciant du marché (Surfline ne le fait pas), l'architecture verdict-par-niveau est réelle et soignée, et les données d'usage montrent un vrai signal de rétention : **182 visiteurs / 608 sessions sur 30 jours = 3,3 sessions par visiteur**, bounce 23 %, durée ~3 min. Les gens reviennent checker. C'est exactement le comportement qu'on veut.

Mais l'audit révèle trois problèmes structurels :

1. **Le score affiché n'utilise pas les données qui font la différence entre un bon et un mauvais call.** Le moteur multiplicatif `scoreV2` ignore complètement les rafales, le windswell et la houle secondaire (mesuré : 84 = 84 = 84 entre glassy, rafales 30 kn et 1,1 m de chop à 9 s). Ces pénalités existent dans l'ancien moteur additif `scoreSurf`… qui ne sert plus qu'à générer des `notes` décoratives. La raison n°1 pour laquelle "un jour de groundswell correct surfe comme de la merde" — le commentaire du code le dit lui-même — n'affecte plus le score.

2. **Trois features sont mortes en prod sans que personne le sache** : "What's driving the score", "Best window" et la StickyInfoBar sont cachées par CSS dans 100 % des états de l'UI (`v2.css:1684,1820` : les deux modes cards/list les masquent). Le DangerBanner sécurité learners, documenté dans CLAUDE.md comme actif, n'existe plus dans le code. ~400 lignes calculent à chaque render pour un affichage invisible.

3. **Zéro fondation pour la croissance** : pas de backend (4 requêtes API par user par visite, licence Open-Meteo free non-commerciale techniquement violée), pas d'URL par spot (zéro SEO long-tail sur "Trigg Beach surf forecast"), pas d'OG tags alors que toute la stratégie marketing est des posts Facebook, zéro test sur 889 lignes de scoring recalibrées chaque semaine.

**La bonne nouvelle** : les corrections les plus rentables sont bon marché. Réintégrer gusts/windswell/houle secondaire dans scoreV2 = quelques heures. Les marées harmoniques surf-grade = ~10 $/an (WorldTides). Les bouées de validation (Rottnest et Cottesloe sont littéralement au large de Trigg, le spot par défaut) = flux IMOS/AODN gratuit. Le stack data recommandé complet coûte ~30-35 $/mois et transforme l'app d'un "reskin d'Open-Meteo" en une plateforme avec correction par spot que personne d'autre n'a à ce prix.

**Verdict d'investisseur** : thèse produit validée par l'usage, exécution scoring à 60 %, dette invisible élevée (features mortes, docs mensongères, zéro test), mais chemin clair et peu coûteux vers "meilleure décision surf du marché". Fonds engagés sous condition de la phase 1 du roadmap (§15).

---

## 2. Faiblesses critiques

Classées par gravité réelle (toutes vérifiées sur le code, ligne à l'appui).

| # | Faiblesse | Preuve | Sévérité |
|---|---|---|---|
| 2.1 | **scoreV2 ignore rafales, windswell, houle secondaire** — les 3 pénalités n'existent que dans `scoreSurf` (additif) devenu générateur de notes | `prodScoring.js:225-283` ; probe : glassy=84, gusts 30 kn=84, windswell 1,1 m@9s=84 ; secondaire idéale 1,5 m@15s sur primaire off-axis → score 3 | CALCUL |
| 2.2 | **LevelMatrix : le surlignage "tu es ici" est décalé d'une ligne pour 3 niveaux sur 6** — intermediate lit le verdict d'early_int comme le sien, expert lit celui d'advanced | `verdict.js:233-235` mappe sur 4 lignes, `levelMatrixFor` en retourne 5 ; `LevelMatrix.jsx:27,44` | BLOQUANT |
| 2.3 | **Kill-switch 12 s vs timeout fetch 15 s** : sur réseau lent (le cas que le timeout 15 s devait protéger), reload forcé + wipe caches en plein chargement | `layout.js:168` vs `MainScreen.jsx:259` ; `__appReady` seulement au finally du fetch | BLOQUANT |
| 2.4 | **Crash potentiel au switch de jour** : `day.hours[selectedIdx]` peut être `undefined` (reset en useEffect post-render) → TypeError écran blanc | `MainScreen.jsx:483,477-481` | BLOQUANT |
| 2.5 | **TideCurve : hooks après early-return conditionnel** — violation des règles de hooks, crash React latent | `TideCurve.jsx:80-84` | BLOQUANT |
| 2.6 | **DangerBanner sécurité learners absent du build** alors que CLAUDE.md le documente comme actif — un first_timer sur rip fort n'a aucun bandeau | grep DangerBanner → 0 ; `v2.css:1798` commente un composant fantôme | DEGRADE (sécurité) |
| 2.7 | **DrivingChips + BestWindow + StickyInfoBar invisibles dans 100 % des états** (masqués par les deux règles CSS de mode) | `v2.css:1684-1693, 1820-1826` | DEGRADE |
| 2.8 | **Paquet timezone** : heure courante en fuseau device vs heures en fuseau spot ; "Today" en date device ; dimming "past" appliqué aux jours futurs ; axe TideCurve converti deux fois | `MainScreen.jsx:466-471`, `realFetch.js:95`, `HourlyList.jsx:161,305`, `TideCurve.jsx:16-19` | CALCUL |
| 2.9 | **Données mock affichées comme réelles** : scores inventés servis en premier à chaque load, dates figées avril 2026, banner d'avertissement anglais uniquement et scrollable hors écran ; ~6 % des loads restent sur mock (44 `forecast_fetch_failed` / 30 j) | `MainScreen.jsx:247-250`, `mock.js:59,100-105` ; PostHog | DEGRADE (confiance) |
| 2.10 | **Marée non surf-grade** : `sea_level_height_msl` = sortie modèle 8 km référencée MSL (pas LAT, pas comparable aux tables australiennes), puis normalisée par le min/max du jour → la profondeur absolue est perdue (neap ≈ spring), tideCtx calculé sur 4 h-20 h seulement | `prodScoring.js:203-215`, `realFetch.js:99,246` ; doc Open-Meteo | CALCUL |
| 2.11 | **Licence Open-Meteo** : tier gratuit explicitement non-commercial ; l'app est commerciale (domaine custom, stratégie de monétisation) | Terms open-meteo.com ; fix = plan Standard 29 $/mois | LEGAL |
| 2.12 | **Zéro SEO structurel** : pas d'URL par spot, contenu 100 % client-rendered, pas d'OG tags (stratégie marketing = Facebook !), pas de robots/sitemap/JSON-LD, `/v2` doublon indexable titré "Not the production experience" | `layout.js:1-13`, `app/v2/layout.js:7-9` | CROISSANCE |
| 2.13 | **Zéro test, zéro lint** sur un moteur de 889 lignes avec une section entière de CLAUDE.md de "décisions à ne pas défaire" — chaque recalibration joue à la roulette | repo entier | DETTE |
| 2.14 | **Alignement par index des arrays marine/wind** sans vérifier `time[i]` : si une API renvoie moins d'heures, le vent d'une heure est associé à la houle d'une autre, silencieusement | `realFetch.js:125-156` | SILENCIEUX |
| 2.15 | **Résolution du score détruite aux deux extrémités** : clamp finalMult 1,35 → 1,0 m @9s/@11s/@13s/@15s = 70 partout ; compressTail floor → 0,9 m et 1,2 m onshore = 32 et 32 | probe §4 ; `prodScoring.js:217-218,792-793` | CALCUL |

---

## 3. Améliorations de précision de prévision

Par ordre de gain de précision par dollar :

**3.1 Marées harmoniques (WorldTides API)** — [Prio 92 · 1 j · fort · moyen]
`sea_level_height_msl` est officiellement décrit par Open-Meteo comme non comparable aux tables de marée (datum MSL, côte à 8 km). WorldTides fournit des prédictions harmoniques avec datum LAT, ~10 $/10 000 crédits ; les marées étant déterministes, 1 appel par spot par semaine se cache → **quelques dollars par an** pour les 90 spots. Justification scientifique : la marée est le seul facteur du score qui est *parfaitement prévisible* — c'est aberrant que ce soit le moins fiable actuellement. Impact : le `tideMult` et la TideCurve deviennent exacts au lieu d'approximatifs, et les reefs (Uluwatu mid-high, Bells mid-high) reçoivent enfin un signal de profondeur absolu.

**3.2 Réintégrer gusts / windswell / houle secondaire dans scoreV2** — [Prio 95 · 0,5 j · fort · fort]
Trois multiplicateurs à ajouter : `gustMult` (delta rafale-moyenne : ≥15 km/h ×0,93, ≥25 ×0,85), `chopMult` (ratio windswell/swell à période courte : ≥0,8 & <11s ×0,82, ≥0,5 & <10s ×0,91), et traitement de la houle secondaire comme **composante à part entière** (cf. §4.2). Justification : ce sont les trois variables qui expliquent les faux positifs "score 80, mer de chop". Détail d'implémentation : hors du clamp [0,40-1,35] actuel ou avec un clamp élargi vers le bas, sinon elles seront écrasées les mauvais jours de la même façon.

**3.3 Ensemble multi-modèles via l'endpoint existant** — [Prio 85 · 1-2 j · fort · moyen]
Open-Meteo Marine sert déjà ECMWF WAM, MFWAM (~8 km) et GFS-Wave par le paramètre `models=` — aucun nouveau vendor. Prendre la **médiane** de Hs/Tp entre 2-3 modèles pour le score, et le **spread** comme signal de confiance affiché ("modèles en désaccord — prévision incertaine"). Justification : la médiane d'ensemble bat quasi systématiquement chaque membre individuel en vérification ; le spread est l'estimateur d'incertitude honnête le moins cher qui existe.

**3.4 Correction de biais par spot ancrée sur les bouées (le "truc Surfline" à échelle bootstrap)** — [Prio 88 · 3-5 j · fort · fort]
Le flux IMOS/AODN (CSV horaire sur AWS Open Data, gratuit) agrège les bouées Waverider de WA DoT (**Rottnest 56005 et Cottesloe 56008 — au large direct de Trigg, le spot par défaut**), MHL NSW (Sydney) et Queensland (Gold Coast, Palm Beach). Logger prévision vs observation, ajuster une régression linéaire par spot (éventuellement binnée par direction/saison), appliquer dans `estimateFaceHeight`. Surfline attribue publiquement son avantage de précision à exactement ce mécanisme (LOTUS = spectral + correction ML sur observations). Bonus produit immédiat : afficher "observé maintenant à la bouée : 1,8 m @ 12 s" à côté de la prévision = crédibilité instantanée que personne d'autre ne montre en Australie gratuitement.

**3.5 Décroissance de confiance par horizon** — [Prio 70 · 0,5 j · moyen · faible]
Un score de J+4 est affiché avec la même autorité qu'un score à +2 h. Ajouter un facteur de confiance (jour 0-1 : plein ; J+3 : bande élargie ; J+4 : tendance seulement) et l'afficher (score en fourchette "55-70" au-delà de J+2). Justification : l'erreur RMS des modèles de vagues double environ entre J+1 et J+5 ; prétendre une précision uniforme est le mensonge le plus courant des apps de surf.

**3.6 Fenêtre de daylight réelle** — [Prio 55 · 15 min · faible]
`hour >= 4 && hour <= 20` en dur (`realFetch.js:244`) alors que sunrise/sunset sont déjà fetchés. À Hossegor en décembre, l'app score des heures de nuit noire.

---

## 4. Améliorations scientifiques (refonte du modèle)

Diagnostic du modèle actuel : `score = baseSize(swellH, level) × periodMult × windMult × dirMult × tideMult`, clamp [0,40-1,35]. La structure multiplicative et la grille par niveau sont de **bonnes idées** (la taille souveraine est défendable). Les défauts sont dans les entrées et les non-linéarités :

**4.1 Hauteur de face : remplacer le boost linéaire par un modèle énergie + shoaling** — [Prio 90 · 2-3 j · fort]
Problèmes mesurés : (a) discontinuité à 0,5 m — 0,49 m@14s → 1,6 ft mais 0,50 m@14s → 2,3 ft, +45 % pour 1 cm de houle, visible à l'écran quand une prévision oscille autour de 0,5 m ; (b) `periodFactor = period/10` clampé [0,7-1,8] est une heuristique sans base physique.
Proposition : face ≈ Hs × Ks(T, profondeur de déferlement) avec Ks le coefficient de shoaling en eau peu profonde (Ks ∝ T^(1/2) à profondeur fixée — la racine, pas le linéaire), transition **lisse** via un facteur d'atténuation continu pour Hs < 0,6 m (tanh) au lieu du seuil dur. La profondeur de déferlement peut être approximée par type de break (beach ~1,3×H, reef slab plus raide) en attendant la bathymétrie (§5.4). Effet : plus de falaise à 0,5 m, et le boost de période devient réaliste (un 15 s ne double pas la face d'un 8 s à hauteur égale, il l'augmente de ~35-40 %).

**4.2 Houle multi-composantes : scorer la meilleure vague, pas la première partition** — [Prio 90 · 1-2 j · fort]
Le moteur ne lit que la partition primaire. Cas mesuré : primaire 0,4 m off-axis + secondaire 1,5 m@15s plein dans l'axe → score 3 (flat) alors que c'est un excellent jour. Fix : calculer le score pour chaque partition (primaire, secondaire) avec sa propre direction/période, prendre le max pondéré, et créditer un bonus "peaks" quand deux houles croisées surfables coexistent sur un beach break. C'est LE cas d'usage de Trigg (windswell local + groundswell de Five Fathom Bank en dessous).

**4.3 Vent : fonctions continues au lieu de bandes binaires** — [Prio 75 · 1 j · moyen]
Actuellement offshore ≤45°, cross 45-135°, onshore ≥135° avec paliers de vitesse. Un vent à 44° et un à 46° ont des multiplicateurs différents ; un 9,9 km/h et un 10,1 km/h aussi. Remplacer par `windMult = f(cos(windDelta), kmh)` continue (par exemple une surface bilinéaire interpolée). Justification : l'effet du vent sur la face est physiquement continu ; les paliers créent des sauts de score horaires que l'utilisateur ne peut pas expliquer, ce qui mine la confiance ("pourquoi 62 à 9 h et 48 à 10 h alors que rien n'a changé ?").

**4.4 Direction : fenêtre d'exposition par spot au lieu d'un unique idéal ± delta** — [Prio 78 · 2 j · fort]
`idealSwellDir` unique + falloff symétrique ignore la géométrie réelle : Trigg reçoit du 210-260° mais le Five Fathom Bank absorbe différemment selon l'angle (la note du spot le dit !) ; Snapper marche du 90 au 180°. Modéliser `swellWindow: [min, max]` + facteur d'ombrage optionnel (îles, caps, banks) par spot. Données : dérivables de la bathymétrie AusSeabed (§5.4) ou simplement curées à la main pour les 90 spots (1 jour de travail avec un guide de spots).

**4.5 Restaurer la résolution du score** — [Prio 82 · 1 j · fort]
Deux compressions détruisent l'information : (a) le clamp finalMult à 1,35 rend période 9 s et 15 s indiscernables les bons jours (probe : 70/70/70/70) — élargir à ~1,6 en re-normalisant la grille, ou remplacer le clamp par une compression douce type tanh ; (b) `compressTail(adj, 30, 38)` en branche SKIP aplatit 0,9 m et 1,2 m au même 32 — compresser depuis un floor plus bas (15) pour garder un gradient. Le score doit rester un **classement** utilisable des heures ; aujourd'hui il ne l'est plus ni en haut ni en bas.

**4.6 Marée : phase + profondeur absolue + direction** — [Prio 80 · 1 j (avec §3.1) · fort]
Avec des marées harmoniques (§3.1), remplacer la normalisation min/max du jour par : hauteur absolue vs datum + coefficient de marée + **direction et vitesse de variation** (le "pushing tide" compte plus que la hauteur statique sur la plupart des beach breaks — le moteur a déjà `tideTrend`, il ne l'utilise pas dans le score). Les reefs reçoivent un seuil de profondeur minimale de sécurité (Uluwatu à marée basse ≠ "×0,92", c'est parfois "no").

**4.7 Variables absentes à intégrer, par ordre de valeur** : consistance (période × énergie → vagues/heure), énergie de houle (E ∝ Hs²·T — différencier 1,5 m@8s de 1,5 m@15s en puissance, pas seulement en face), courants pour tous niveaux (aujourd'hui learners only), lumière (score nul hors daylight, golden hour bonus photographes §14), température eau → recommandation combinaison (donnée déjà fetchée, affichée, jamais exploitée en conseil).

**4.8 Ce qui est déjà scientifiquement correct et à préserver** : la matrice USER_LEVEL_ZONES et sa monotonie de ladder, le verdict source-de-vérité unique `getPersonalVerdict`, les caps sécurité (gale, rip, reef learners), l'absence de floor artificiel (décision CLAUDE.md justifiée), l'inférence de profil pour les spots libres (pondération quadratique par hauteur = bon instinct).

---

## 5. Améliorations de données

Synthèse de la recherche sources (détails, prix et URLs vérifiés en 2026) :

**5.1 Mise en conformité Open-Meteo** — [Prio 96 · 1 h · legal] Plan Standard **29 $/mois** (1 M appels/mois, host `customer-api` + clé). Le tier gratuit est non-commercial ; c'est l'option légale la moins chère du marché, aucune raison de ne pas la prendre.

**5.2 WorldTides pour les marées** — [Prio 92 · cf. §3.1] ~10 $/10k crédits, datum LAT, cache hebdomadaire par spot → coût annuel en dollars à un chiffre. Alternative AU-only : WillyWeather (marées harmoniques BOM officielles, micro-centimes/requête) si le focus reste australien.

**5.3 Bouées temps réel gratuites** — [Prio 88 · cf. §3.4] IMOS/AODN sur AWS Open Data (WA + NSW + QLD, horaire), Queensland CKAN API (la mieux outillée), NOAA NDBC pour les spots US (`realtime2/{station}.txt`, gratuit). Usage : validation/correction (§3.4) + affichage "observé maintenant".

**5.4 Bathymétrie ouverte pour les métadonnées de spot** — [Prio 65 · 3-5 j] AusBathyTopo 30 m (gratuit, AusSeabed) est réellement utilisable pour estimer profondeur de déferlement et fenêtres d'exposition des spots australiens ; GEBCO 15" (~450 m) pour l'échelle du plateau ailleurs. Pas de SWAN par spot à ce stade — précomputer des métadonnées statiques (exposition, pente) suffit pour 80 % de la valeur.

**5.5 À ne PAS faire** : construire sur les endpoints non documentés de Surfline (risque ToS pour une app commerciale) ; payer Stormglass 49 €+/mois pour un blending faisable soi-même sur l'endpoint déjà utilisé ; les Registered User Services du BOM (coût 4-5 chiffres/an).

**5.6 Architecture de fusion recommandée** (cf. §8) : un backend mince fetch par spot+heure (pas par user), fusionne médiane multi-modèles + correction bouée + marée harmonique, et sert un JSON scoré unique. Coût total du stack : **~30-35 $/mois**.

---

## 6. Opportunités Machine Learning

Par ROI décroissant — tout est faisable sans infra lourde :

**6.1 Correction par spot supervisée par bouées** — [Prio 88 · 1 sem · fort] Cf. §3.4. Commencer par une régression linéaire par spot (features : Hs, Tp, direction, saison), passer à un GBM léger quand ≥3 mois de données. Entraînement batch nocturne (cron Vercel), coefficients shippés en JSON statique consommé par le scoring. C'est le mécanisme exact qui a donné à Surfline ses ~30 % d'amélioration revendiqués — la version régression capture la majorité du gain.

**6.2 Boucle de feedback utilisateur = data flywheel** — [Prio 85 · 1 sem · fort] Après une heure marquée GO, prompt 1-tap le soir : "T'es allé ? C'était comment ? 👍/👎/🤯". Chaque réponse = un point (conditions prévues, niveau, verdict, réalité). À 50 réponses/spot on calibre les seuils de `USER_LEVEL_ZONES` par spot ; à 500 on entraîne un correcteur de verdict. **C'est le moat** : Open-Meteo est copiable en un week-end, un dataset de vérité terrain par niveau ne l'est pas. Aucun concurrent ne collecte "était-ce surfable pour un débutant ?" — Surfline collecte des observations d'experts.

**6.3 Confiance par régression quantile** — [Prio 60 · 3 j · moyen] Prédire P25/P75 de la face au lieu d'un point → affichage honnête en fourchette, croissante avec l'horizon (§3.5). Entraînable sur l'historique forecast-vs-buoy accumulé par 6.1.

**6.4 Détection d'anomalies data** — [Prio 55 · 1 j · faible] Garde-fou statistique sur les réponses API (saut de 3 m entre deux heures, période 25 s, vent 200 km/h) → flag "donnée suspecte" au lieu de scorer du bruit. Répond aussi au bug d'alignement §2.14.

**6.5 Personnalisation** (plus tard) : après le journal de sessions (§14), apprendre les préférences individuelles (biais taille, tolérance au vent) et décaler le verdict perso. Ne pas faire avant d'avoir le flywheel 6.2.

---

## 7. Améliorations UI/UX

**7.1 Le verdict perso doit être la première chose visible** — [Prio 90 · 0,5 j · fort] L'app s'appelle "Should You Surf?" et la réponse (GO/MAYBE/SKIP niveau) vit sous les cartes horaires, dans un panneau. Le hero affiche la bande objective ("Good 52") qui peut contredire visuellement le SKIP perso d'un learner. Mettre le mot GO/MAYBE/SKIP coloré + le tip en hero, la bande objective en second. Un utilisateur doit avoir sa réponse en <3 secondes sans scroll.

**7.2 Trancher le sort des features mortes** — [Prio 88 · 1-2 j] DrivingChips/BestWindow/StickyInfoBar (§2.7) : soit réintégrer chips + best window dans le panneau horaire, soit supprimer ~400 lignes + la machinerie sticky de MainScreen (80 lignes). "Best window" est trop utile pour mourir : c'est la réponse à "quand ?" après "oui".

**7.3 Re-porter le DangerBanner** — [Prio 85 · 1-2 h · sécurité] Cf. §2.6.

**7.4 Paquet timezone** — [Prio 84 · 0,5 j] Cf. §2.8 : heure courante via `Intl` avec `effectiveSpot.timezone`, todayStr en date spot, garde `isToday` sur le dimming, axe TideCurve depuis `hours[i].time`. Quatre fixes, un après-midi, et l'app devient correcte pour les voyageurs — un des personas cibles.

**7.5 Honnêteté du mode dégradé** — [Prio 80 · 0,5 j] Sur mock : masquer les scores (skeleton) ou les griser + badge par carte, dates générées depuis `Date.now()`, banner traduit et persistant, masquer "UPDATED 0M AGO". 6 % des loads sont concernés (PostHog).

**7.6 List mode : tip désynchronisée de la ligne dépliée** — [Prio 75 · 30 min] `HourlyList.jsx:97-149` : la ligne 6 h dépliée affiche le verdict de 15 h. Synchroniser openIdx et selectedIdx.

**7.7 ScoreSheet quasi inutilisé : 13 ouvertures / 727 pageviews (1,8 %)** — [Prio 60 · 1 j] La transparence du score est un différenciateur enterré derrière un tap invisible. Exposer la décomposition en une ligne compacte sous le hero ("Taille 78 × vent 1,20 × direction 1,10") cliquable pour le détail. Mesurer ensuite.

**7.8 Accessibilité** — [Prio 65 · 1 j] Verdicts en couleur seule (dots 4 px), micro-typo 7,5-9,5 px sous les seuils WCAG, cibles tactiles 24-34 px, modales sans role/focus-trap/Échap, slider sans clavier. Pour une app "sécurité", l'a11y n'est pas cosmétique.

**7.9 Divers vérifiés** : onboarding skippé définitivement par un tap sur le backdrop (`OnboardingModal.jsx:10`) ; fermeture MapPicker qui ferme aussi BreakPicker (propagation) ; boutons share/fav codés mais jamais rendus (le partage — canal de croissance — est inatteignable !) ; `HourlyList key={effectiveLevel}` qui reset le viewMode au changement de niveau ; couleurs de verdict hardcodées qui jurent en nocturnal.

---

## 8. Améliorations backend

**Il n'y a pas de backend — c'est le choix architectural n°1 à changer.** — [Prio 90 · 1-2 sem · fort · fort]

Aujourd'hui : chaque client fait 4 requêtes Open-Meteo à chaque visite/changement de spot, zéro cache partagé, la clé commerciale (§5.1) ne peut pas être protégée, aucun push possible, aucun historique forecast-vs-réalité ne peut s'accumuler, aucune page SSR par spot n'est possible.

Cible : **route handlers Next (edge) + KV/Postgres léger** :
- `GET /api/forecast/[spotId]` : fetch Open-Meteo par spot **une fois par heure pour tous les users** (cache s-maxage 1800), applique fusion multi-modèles + correction bouée + marée harmonique, renvoie le payload scoré. Réduit la charge API de ~608 sessions × 4 requêtes à ~90 spots × 24/jour, rend le plan 29 $/mois surdimensionné de 10×.
- Cron nocturne : ingestion bouées AODN + archivage forecast/observation (le carburant du §6).
- Push : endpoint subscribe + job "ton créneau demain" (la feature notifications actuelle est cosmétique : one-shot local, constructeur qui throw sur Android/iOS — `MainScreen.jsx:353`).
- Corrections immédiates côté client en attendant : AbortController sur les fetchs (le Promise.race actuel laisse la requête consommer la data mobile), vérification d'alignement `time[i]` marine/wind (§2.14), flag cancelled sur le refetch visibilitychange (race spot A/spot B, `MainScreen.jsx:294-316`).

---

## 9. Améliorations infrastructure

| Item | Détail | Prio |
|---|---|---|
| Tests + CI | Vitest sur prodScoring/verdict (~40 cas : invariants CLAUDE.md, monotonie du ladder, bornes, snapshots de la grille) + GitHub Action build+test. Le plus gros levier qualité du repo : les recalibrations hebdo n'ont aucun filet. | 90 |
| ESLint + rules-of-hooks | Aurait attrapé le bug TideCurve (§2.5) mécaniquement. | 80 |
| `version.json` hors git | Build artifact commité → rituel fragile "git restore avant add" documenté dans CLAUDE.md. Gitignorer, Vercel le régénère au build. Supprimer aussi `Date.now()` de la version (chaque redeploy identique force-reload tous les clients). | 70 |
| Bump Next 14.2.15 → dernière 14.2.x | CVE-2025-29927 et -56332 non exploitables ici mais patch trivial. | 60 |
| Headers sécurité | nosniff, frame-ancestors, Referrer-Policy, Permissions-Policy = 10 lignes de next.config. | 55 |
| Hygiène | `styled-jsx` dep inutilisée ; `sharp` requis par 2 scripts mais non déclaré (MODULE_NOT_FOUND sur clone frais) ; `.vercel/project.json` commité ; scripts deploy laptop `vercel --prod` contournant le workflow git (supprimer) ; splash iOS générés avec l'ancien branding bleu clair. | 50 |
| CLAUDE.md à réécrire | Faux sur : v1 à `/` (n'existe plus), 6 thèmes (5), "10 langues sans tips" (les tips sont traduits partout, c'est FAQ/onboarding/safety qui manquent), SCORE_SCALE périmé, DangerBanner "actif". Un doc de contexte faux est pire que pas de doc : chaque session future re-dérive de mauvaises décisions. | 75 |

---

## 10. Améliorations SEO

Par impact organique :

1. **Pages par spot `/spot/[id]` en SSG** — [Prio 92 · 1-2 j] 90+ pages "«Spot» surf forecast" avec metadata serveur, verdict du jour pré-rendu, contenu statique par spot (orientation, marée idéale, saison, notes). C'est LE trafic naturel du produit ("trigg beach surf report" etc.) et il est aujourd'hui à zéro car tout est client-rendered derrière un splash. Programmatic SEO extensible : ×12 langues plus tard, ×"this weekend", ×"for beginners" (unique au produit !).
2. **OG tags + image dynamique** — [Prio 90 · 0,5 j] Toute l'acquisition actuelle est Facebook et chaque partage rend un lien nu. `metadataBase` + OG + image 1200×630 générée par spot/verdict (`@vercel/og` : "Trigg Beach — GO for beginners today, 3 ft clean") = chaque partage devient une pub.
3. **robots.txt + sitemap.xml natifs Next** — [Prio 80 · 30 min]
4. **Redirect 308 `/v2` → `/`** — [Prio 78 · 10 min] Doublon indexable titré "Not the production experience" ; `shareSpot` génère des URLs `/v2?spot=`.
5. **JSON-LD** (WebApplication + par-spot Place/GeoCoordinates) — [Prio 55 · 2 h]
6. **`html lang` dynamique + hreflang** quand les pages spot existeront — [Prio 45]

---

## 11. Améliorations performance

Constat build : First Load JS 193-194 kB, honnête pour l'app actuelle. Les vrais problèmes :

1. **surfer.mp4 5,3 MB en preload auto sur chaque load** (le README de l'asset exige <3 MB) — ré-encoder 720p/CRF30 (~1-1,5 MB) + `preload="metadata"` + poster. [Prio 85 · 30 min]
2. **Splash minimum forcé ~2,5 s** (`MIN_SHOW 1500` + `setTimeout 2500`) : LCP volontairement sacrifié sur 100 % des visites d'une app dont la promesse est la vitesse de décision. Réduire à ≤1 s ou splash uniquement au premier load à froid. [Prio 82 · 30 min]
3. **setState par frame de scroll** (`setDayNavTop`) → re-render de l'arbre entier à 60 fps, aucun enfant memoïsé. Passer en CSS sticky + `React.memo` sur HourlyList/TideCurve/LevelMatrix. [Prio 75 · 2 h]
4. **i18n.js 244 kB dans le bundle** pour 12 langues dont 1 utilisée — dynamic import par langue (~40-60 kB gzip gagnés). [Prio 60 · 2-3 h]
5. **Triple stack analytics** (GA + PostHog+Replay + Clarity) — en garder deux max. [Prio 50 · 30 min]
6. **Double calcul du score** : scoreV2 réinvoque scoreSurf entier pour les notes, × heures × jours × niveaux à chaque changement de niveau. Extraire le générateur de notes. [Prio 45 · 1 h]
7. Nettoyage : plusieurs centaines de lignes de CSS mort, composants morts (Icons.jsx, WaveGlyph/FaceHeightHero, sélecteur `.hly-row` fantôme, listeners TideCurve non nettoyés). [Prio 40 · 2-3 h]

---

## 12. Opportunités de revenus

Modèle recommandé : **freemium B2C + B2B niche**, pas de pub display (incompatible avec "décide en 10 secondes" et détruirait la confiance qui est le produit).

**12.1 Premium B2C "SYS Pro" (5-7 $/mois)** — [Prio 85] Le gratuit reste le meilleur check 5 jours du marché. Le Pro vend : alertes push "ta fenêtre GO demain 7-9 h" (impossible sans backend §8 — c'est la feature qui convertit, car c'est elle qui économise du temps), prévision 10-16 jours (ECMWF open data), fourchettes de confiance + spread multi-modèles, comparaison multi-spots ("où aller ce matin dans un rayon de 30 min"), journal de sessions illimité. Benchmark : Surfline Premium ~100 $/an avec les caméras comme carotte ; sans caméras, viser 40-60 $/an sur la promesse décision.

**12.2 Affiliation planches et wetsuits contextuelles** — [Prio 75 · quasi gratuit] `getBoardRec` recommande déjà une planche par heure et par niveau ("Mid-length 7'0") — c'est un slot d'affiliation naturel et honnête (le conseil existe déjà, on ajoute juste "en trouver une"). Idem température eau → combinaison (donnée déjà affichée). Commissions surf retail 5-10 %.

**12.3 B2B écoles de surf** — [Prio 70] Le verdict par niveau est un outil opérationnel d'école (annuler/déplacer les cours débutants). Widget embarquable "conditions pour débutants aujourd'hui" en marque blanche + dashboard multi-jours : 20-50 $/mois par école. Personne ne sert ce besoin — Surfline parle aux surfeurs confirmés.

**12.4 Voyage** — [Prio 55] "Best week finder" (quand aller à Uluwatu pour un intermediate ?) sur l'historique ERA5 → affiliation hébergement/vols surf trips. Plus tard : les données de séjour des surf camps.

**12.5 API/licence du moteur de verdict** — [Prio 40, plus tard] Une fois calibré par le flywheel (§6.2), le verdict-par-niveau devient licenciable (offices de tourisme, assurances activités nautiques, plateformes de réservation de cours).

Anti-recommandations : sponsored forecasts (mort de la confiance), pubs display, vendre les données de localisation.

---

## 13. Avantages compétitifs (existants et à construire)

**Existants, réels :**
1. Le **verdict par niveau** — aucun grand acteur ne répond "devrais-JE y aller", tous décrivent les conditions. La matrice ladder + inside-reform + caps sécurité learners est une vraie IP produit.
2. La recommandation de planche contextuelle.
3. Gratuit, sans compte, PWA rapide — friction zéro face à un Surfline paywallé.
4. Signal de rétention déjà démontré (3,3 sessions/visiteur/mois).

**À construire (défendables) :**
5. Le dataset feedback "était-ce surfable pour mon niveau ?" (§6.2) — impossible à rattraper pour un concurrent qui ne pose pas la question.
6. Correction par bouée en Australie (les flux AODN sont gratuits mais personne ne les intègre dans une UI grand public).
7. La transparence du score (décomposition visible) comme positionnement anti-boîte-noire face à LOTUS.

---

## 14. Features que les concurrents n'ont pas

Classées par (valeur × faisabilité) :
1. **"Où aller maintenant"** : classement des spots favoris par verdict perso à cet instant + trajet. Répond à la vraie question du samedi matin. [après backend]
2. **Alertes de fenêtre perso** (push) : "GO pour ton niveau demain 7-9 h à Trigg" — les alertes Surfline sont par taille brute, pas par adéquation au niveau.
3. **"Observé à la bouée maintenant"** à côté de la prévision (§3.4) — crédibilité que même Surfline ne montre pas en Australie.
4. **Journal de sessions 1-tap** qui nourrit le flywheel (§6.2) et crée streaks/achievements → rétention + moat data en un seul geste.
5. **Mode école/parent** : vue simplifiée "sûr pour un enfant débutant aujourd'hui ? oui/non + pourquoi" (extension du DangerBanner ressuscité).
6. **Fourchette de confiance honnête** (§3.5) — personne n'affiche l'incertitude ; en faire une signature ("on te dit quand on ne sait pas").
7. **Best week finder voyage** (ERA5 déjà accessible) : climatologie par spot par mois pour planifier un trip à son niveau.
8. **Golden hour surf** pour photographes : croisement lumière × conditions (sunrise/sunset déjà fetchés).

---

## 15. Roadmap par ROI

| Rang | Chantier | Coût | Retour attendu |
|---|---|---|---|
| 1 | **Sprint intégrité** : fixes bloquants (2.2-2.5), paquet timezone, DangerBanner, honnêteté mock, verdict en hero | ~1 sem | La confiance — le produit ne ment plus nulle part |
| 2 | **Sprint scoring v3** : gusts/windswell/secondaire, face height continue, résolution restaurée, marées WorldTides + tests vitest verrouillant le tout | ~1,5 sem | Le score reflète enfin la réalité du lineup ; chaque recalibration future est protégée |
| 3 | **SEO + partage** : pages /spot/[id] SSG, OG images, robots/sitemap, redirect /v2, bouton share ressuscité | ~1 sem | Acquisition organique composée ; chaque partage FB devient riche |
| 4 | **Backend mince** : cache par spot, conformité licence, ingestion bouées, archivage forecast-vs-obs | ~1,5 sem | Débloque push, correction ML, pages SSR, coûts API divisés par 10 |
| 5 | **Flywheel + push** : feedback 1-tap, alertes fenêtre perso, premium | ~2 sem | Rétention → moat data → première ligne de revenu |
| 6 | Correction ML par spot, confiance quantile, "où aller maintenant", B2B écoles | continu | Différenciation durable |

## 16. Roadmap par effort d'ingénierie

- **Trivial (<1 h chacun)** : 2.2 (mapping 5 lignes), 2.5 (déplacer useRef), 2.3 (kill-switch 20 s + __appReady au seed), redirect /v2, robots+sitemap, headers sécu, gitignore version.json, bump Next, deps hygiène, badge UPDATED masqué sur mock, garde isToday dimming, D6 resync today, skip tracking au mount, clamp selectedIdx, stopPropagation MapPicker, onboarding backdrop.
- **Court (0,5-1 j)** : OG tags+image, mp4 ré-encodé + splash réduit, gusts/windswell dans scoreV2, timezone pack, tip list-mode sync, mock honnête, verdict en hero, memo+CSS sticky, strings safety ×11 langues.
- **Moyen (2-5 j)** : face height continue + multi-composantes + résolution, marées harmoniques, suite de tests, pages /spot/[id], i18n des strings hardcodées (1-2 j), tri features mortes, ensemble multi-modèles.
- **Long (1-3 sem)** : backend + cache + bouées + archivage, push + premium, flywheel feedback, correction ML, fenêtres d'exposition bathymétriques.

## 17. Quick wins (<2 h chacun)

1. `LEVEL_TO_MATRIX_IDX = { first_timer:0, beginner:0, early_int:1, intermediate:2, advanced:3, expert:4 }` (5 min — bug le plus visible de l'app).
2. `useRef` avant l'early-return dans TideCurve (5 min).
3. `window.__appReady = true` dès le seed mock + kill-switch à 20 s (15 min).
4. Clamp `day.hours[Math.min(selectedIdx, day.hours.length-1)]` (15 min).
5. Redirect 308 `/v2` → `/` + retirer le title "Preview" (15 min).
6. `app/robots.js` + `app/sitemap.js` (30 min).
7. OG minimal : metadataBase + openGraph + une image statique 1200×630 (1 h — chaque partage FB en profite immédiatement).
8. Garde `day.isToday` sur le dimming past + resync dayIdx sur today (30 min).
9. Masquer "UPDATED 0M AGO" et les scores pleins sur dataSource mock (30 min).
10. `registration.showNotification` au lieu de `new Notification` + label honnête (1 h).
11. `git rm --cached public/version.json` + .gitignore + purge de l'étape 3 du process CLAUDE.md (15 min).
12. Ré-encodage surfer.mp4 → ~1,2 MB (30 min).
13. Traduire `danger_banner` + `footer_disclaimer` dans les 11 langues manquantes (30 min).
14. Réécrire CLAUDE.md sur les 6 points faux identifiés (30 min).

## 18. Projets moyens (0,5-2 semaines)

1. **Scoring v3** (§4.1, 4.2, 4.5, 3.2) + suite vitest de 40 cas — le cœur.
2. **Marées harmoniques** WorldTides + refonte tideMult (§4.6).
3. **Pages spot SSG** + OG dynamiques + programmatic SEO (§10).
4. **Paquet timezone complet** + i18n des ~60 strings hardcodées.
5. **Tri des features mortes** : réintégrer BestWindow + chips dans le panneau, supprimer la machinerie sticky, re-porter le DangerBanner.
6. **Passe a11y** (§7.8).

## 19. Projets majeurs (2-6 semaines)

1. **Backend forecast** (§8) : cache par spot, fusion multi-modèles, ingestion bouées AODN/NDBC, archivage forecast-vs-observation, push. Le prérequis de tout le reste.
2. **Premium + alertes de fenêtre perso** (§12.1).
3. **Flywheel feedback + correction ML par spot** (§6.1, 6.2).
4. **"Où aller maintenant"** multi-spots (§14.1).
5. **Métadonnées bathymétriques** par spot AU (fenêtres d'exposition, profondeur de déferlement) (§5.4).

## 20. Idées révolutionnaires

1. **Le "Waze du surf"** : le flywheel feedback (§6.2) à maturité = conditions *vérifiées par la foule par niveau*, en boucle avec le modèle. Surfline a des caméras et des experts ; personne n'a un réseau de vérité terrain stratifié par niveau de surfeur. À 10k users actifs, chaque spot populaire a sa calibration quotidienne.
2. **Score de progression** : croiser journal de sessions × conditions réelles = "tu as surfé 14 sessions en zone sweet, tu es prêt pour early_int" — l'app fait *progresser* le niveau qu'elle score, boucle de rétention unique et défendable.
3. **Verdict garanti** : afficher publiquement la précision (verdicts GO confirmés par le feedback, par spot). "87 % de nos GO à Trigg confirmés par les surfeurs le mois dernier" — aucune app météo n'ose publier sa propre vérification. La transparence comme arme de marque.
4. **SYS Sessions B2B2C** : le verdict par niveau alimenté aux écoles/camps (annulation intelligente, upsell de créneaux), qui en retour injectent du feedback expert quotidien dans le flywheel — les moniteurs sont les meilleurs labelers du monde et ils checkent les conditions tous les matins.
5. **Prévision d'affluence** : corréler les données d'usage de l'app (checks par spot par heure, anonymisées) + weekend/vacances/qualité = "GO mais 40+ à l'eau probablement — le spot B à 15 min est MAYBE mais vide". Le crowd est la variable que tous les surfeurs intègrent et qu'aucune app ne modélise.

---

*Fin du rapport. Aucune modification de code n'a été faite — ce document est le livrable, comme demandé. Les fixes des sections 17-19 sont prêts à être promptés un par un.*
