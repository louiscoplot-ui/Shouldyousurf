---
name: surf-app-audit
description: >
  Audit profond du code "Should You Surf?" — détecte bugs, calculs incorrects,
  contradictions logiques dans les scores/conseils/tips, incohérences UX,
  ralentissements et erreurs silencieuses. Utiliser quand Louis demande un audit,
  "trouve les bugs", "qu'est-ce qui cloche dans le score", "check tout",
  ou après une session de features. Produit un rapport priorisé BLOQUANT/DEGRADE/CALCUL/UX/PERF
  avec prompts Claude Code prêts pour chaque fix.
---

# Should You Surf? — Deep Audit Skill

## Mission

Lire CHAQUE fichier du repo en entier avant de commencer.
Ne rien coder. Produire uniquement un rapport structuré.
Attendre validation avant de toucher quoi que ce soit.

---

## Domaines à auditer en priorité

### 1. LOGIQUE DE SCORE (priorité absolue pour un surf app)

Chaque score final affiché doit être tracé de la source API jusqu'à l'UI.
Questions à se poser pour chaque score :

- D'où vient la valeur brute ? (Open-Meteo, Stormglass, autre API météo/océan ?)
- Quelle formule de normalisation est appliquée ? Est-elle documentée ?
- Y a-t-il des cas où le score peut être > 10 ou < 0 (overflow/underflow) ?
- Si plusieurs variables sont combinées (vagues + vent + marée + période), les poids somment-ils bien à 100% ?
- Un score de 8/10 par beau temps correspond-il vraiment à des conditions excellentes ?
- Les seuils (ex: "bon au-dessus de 6") sont-ils cohérents avec la réalité surf ?
- Y a-t-il des inversions logiques ? (ex: vent offshore = bon, mais codé comme mauvais ?)
- Le score affiché est-il arrondi de manière cohérente partout (integer vs float) ?

Variables clés à tracer :
- `waveHeight` / `swellHeight` — unité (m ou ft ?), source, normalisation
- `wavePeriod` — seuils courts vs longs (période < 8s = mauvais, > 12s = excellent ?)
- `windSpeed` + `windDirection` — offshore/onshore/sideshore logique correcte ?
- `swellDirection` vs orientation de la plage — calcul d'angle exposé correct ?
- `tideHeight` — intégré dans le score ou ignoré ?
- `waterTemp` — affiché uniquement ou influence le score ?

### 2. CONTRADICTIONS CONSEILS / SCORE

- Le conseil affiché contredit-il le score numérique ?
  Ex: score 7/10 mais conseil "conditions difficiles, pas recommandé"
- Les tips changent-ils de manière fluide ou par paliers brusques non expliqués ?
- Si score = 5.0, le message est-il "Passable" ou "Bon" selon la branche choisie ? (off-by-one)
- Les labels de niveau ("Débutant", "Intermédiaire", "Expert") correspondent-ils
  aux vraies conditions décrites par les valeurs brutes ?

### 3. UNITÉS ET CONVERSIONS

- Mélange de mètres et pieds pour les vagues ?
- km/h vs noeuds vs m/s pour le vent ? Conversion correcte ?
- Degrés Celsius vs Fahrenheit pour la température ?
- Timestamps : UTC vs heure locale de la plage ?
- Affichage 12h vs 24h selon la locale ?

### 4. DONNÉES API / FRAÎCHEUR

- Les données sont-elles cachées et si oui pour combien de temps ?
- Un cache périmé peut-il afficher un score d'hier pour aujourd'hui ?
- Que se passe-t-il si l'API météo/océan retourne null ou un champ manquant ?
  (fallback présent ou crash silencieux ?)
- Les requêtes API ont-elles un timeout configuré ?
- En cas d'erreur API, l'UI montre-t-elle une erreur claire ou un score de 0 trompeur ?

### 5. ERREURS SILENCIEUSES

- try/catch qui avalent sans feedback utilisateur
- fetch sans vérification `.ok` ou `.status`
- Division par zéro possible dans les calculs de score
- NaN qui se propage dans les calculs (ex: `undefined + 3 = NaN`)
- Spinner infini si API timeout
- Score affiché comme "–" ou "0" sans explication

### 6. UX ET LISIBILITÉ

- Les plages et leurs orientations sont-elles correctement encodées ?
- L'heure de la prévision (ex: "06h00") correspond-elle au bon fuseau horaire ?
- Les graphiques (si présents) ont-ils des axes clairement labelisés avec unités ?
- Les couleurs du score (rouge/orange/vert) sont-elles accessibles aux daltoniens ?
- Sur mobile, les éléments clés (score, conseil principal) sont-ils above the fold ?
- Y a-t-il des états vides non gérés (aucune plage sélectionnée, aucune donnée) ?

### 7. PERFORMANCE ET FLUIDITÉ

- Combien de requêtes API sont déclenchées au mount du composant principal ?
- Y a-t-il des re-renders inutiles sur chaque update de state ?
- Les images/vidéos (ex: loading screen `surfer2.mp4`) bloquent-elles le rendu ?
- Y a-t-il des memory leaks (event listeners non cleaned up, intervals non cleared) ?
- Le bundle JS est-il optimisé (lazy loading, code splitting) ?

### 8. COHÉRENCE DONNÉES MULTIPLES SPOTS

- Si plusieurs plages sont disponibles, les scores sont-ils comparables
  (même formule appliquée à toutes) ?
- Une plage exposée nord et une plage exposée sud donnent-elles des scores différents
  pour le même swell, comme attendu ?

---

## Format du rapport

Pour chaque problème trouvé :

```
NUMÉRO — TITRE COURT [CATÉGORIE]
Fichier:ligne exact
Code exact concerné (citation courte)
Impact surfeur : ce que l'utilisateur vit concrètement
Sévérité : BLOQUANT / CALCUL / DEGRADE / UX / PERF / SILENCIEUX
Cause technique : 1 ligne
Fix estimé : X minutes
```

---

## Sévérités

- **BLOQUANT** : l'app crash, le score ne s'affiche pas, données totalement fausses
- **CALCUL** : le score est mathématiquement incorrect ou incohérent
- **DEGRADE** : feature qui marche mais donne une mauvaise impression ou confond l'utilisateur
- **UX** : interface cassée visuellement ou logiquement
- **PERF** : lenteur visible, spinner, latence injustifiée
- **SILENCIEUX** : bug caché sans erreur visible, pourrait passer inaperçu longtemps

---

## À la fin du rapport

### Top 5 fixes prioritaires

Tableau : # / Fix / Sévérité / Temps estimé / Impact surfeur

### 3 quick wins (< 15 min chacun)

Fixes rapides à fort impact perçu.

### Recommandations architecture score

Si la logique de score est fondamentalement à retravailler, proposer une architecture
propre : constantes de poids dans un fichier dédié, fonction `computeScore(conditions)` 
testable, seuils documentés avec justification surf réelle.

---

## Fichiers à auditer (adapter selon le repo réel)

**Score / Logique métier :**
- `src/utils/scoreCalculator.js` (ou équivalent)
- `src/utils/conditions.js`
- `src/constants/thresholds.js`
- Tout fichier contenant `waveHeight`, `windSpeed`, `swellPeriod`

**Data fetching :**
- `src/api/` ou `src/services/`
- Hooks : `useSurfConditions`, `useWeather`, `useForecast`
- Tout fichier contenant `fetch(`, `axios.`, `useEffect`

**UI / Affichage :**
- Composants affichant le score (`ScoreCard`, `ConditionsPanel`, etc.)
- Composants de conseil/tips (`Advice`, `Tips`, `Recommendations`)
- `LoadingScreen.jsx`
- Composants de graphiques/charts si présents

**Config :**
- `.env` / `.env.local` (clés API, endpoints)
- `vite.config.js` / `webpack.config.js`
- `package.json` (dépendances, versions)
