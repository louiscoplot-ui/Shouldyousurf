---
name: surf-sprint-prompt
description: >
  Prompt complet de sprint d'audit + fix pour "Should You Surf?". Couvre la lecture
  exhaustive du repo, l'audit en 7 angles parallèles (calcul de score, contradictions
  conseil/score, unités, erreurs silencieuses, données API, UX surf, perf), la
  génération d'un rapport structuré et la production de prompts de fix prêts à coller.
  Utiliser quand Louis lance un sprint de cleanup, demande "fais un sprint d'audit",
  "génère les prompts de fix", ou "audit + fix complet".
---

# Should You Surf? — Deep Audit & Fix Prompt
# À coller dans Claude Code au début d'une session dédiée

---

## PHASE 1 — LECTURE COMPLÈTE DU REPO (obligatoire avant tout)

Commence par lire TOUS les fichiers suivants en entier, sans exception.
N'écris aucun code avant d'avoir terminé la lecture complète.

```bash
# Donne-moi d'abord la structure complète du projet
find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" | sort

# Puis lis chaque fichier
cat package.json
cat vite.config.js 2>/dev/null || cat webpack.config.js 2>/dev/null
cat src/main.jsx 2>/dev/null || cat src/index.jsx 2>/dev/null
cat src/App.jsx 2>/dev/null || cat src/App.js 2>/dev/null

# Fichiers de calcul (lis TOUT ce qui contient ces mots-clés)
grep -rl "waveHeight\|swellHeight\|windSpeed\|wavePeriod\|score\|Score" src/ --include="*.js" --include="*.jsx"
# Puis cat chacun des fichiers trouvés

# Fichiers de data fetching
grep -rl "fetch\|axios\|useEffect\|useSurf\|useWeather\|useConditions" src/ --include="*.js" --include="*.jsx"
# Puis cat chacun

# Fichiers de constantes et seuils
find src/ -name "*.js" -o -name "*.jsx" | xargs grep -l "threshold\|THRESHOLD\|weight\|WEIGHT\|seuil\|const.*=.*[0-9]\." 2>/dev/null

# Fichiers d'affichage du score et des conseils
grep -rl "score\|conseil\|advice\|tip\|recommend\|condition" src/ --include="*.jsx" --include="*.tsx"
```

---

## PHASE 2 — AUDIT SYSTÉMATIQUE (7 agents parallèles)

Après lecture complète, audite le code avec ces 7 angles simultanément.
Pour chaque problème trouvé, utilise ce format :

```
[CODE] NUMÉRO — TITRE COURT
Fichier:ligne
Citation du code problématique
Impact surfeur : [ce que le surfeur vit concrètement]
Sévérité : BLOQUANT | CALCUL | DEGRADE | UX | PERF | SILENCIEUX
Cause : [1 ligne technique]
Fix : ~X min
```

---

### AGENT 1 — Correcteur de Calcul de Score

Pour chaque variable qui entre dans le score final, trace la chaîne complète :

**Vérifications obligatoires :**

1. **Overflow/underflow** : le score peut-il dépasser 10 ou descendre sous 0 ?
   Cherche : `Math.max`, `Math.min`, clipping présent ?

2. **Poids qui ne somment pas à 1** :
   Cherche toutes les multiplications de score : `score += X * weight`
   Additionne tous les `weight` — font-ils bien 1.0 (ou 100%) ?

3. **Inversions logique surf** :
   - Vent offshore (venant de la terre vers la mer) = BON pour le surf
   - Vent onshore (venant de la mer vers la terre) = MAUVAIS
   - Vérifie : `windDirection` par rapport à `beachOrientation` — la logique est-elle inversée ?
   - Période longue (> 12s) = meilleure qualité de vague — vérifié ?
   - Marée montante vs descendante — impact codé ?

4. **NaN propagation** :
   Cherche toute opération arithmétique sans guard :
   ```js
   // DANGEREUX — si waveHeight est undefined : NaN
   const score = waveHeight * 2 + windBonus
   // CORRECT
   const score = (waveHeight ?? 0) * 2 + (windBonus ?? 0)
   ```

5. **Division par zéro** :
   Cherche : `/ swellPeriod`, `/ waveCount`, `/ totalWeight` — valeur zéro possible ?

6. **Seuils incohérents** :
   Note tous les seuils trouvés (ex: "wave > 1.5m = bon") et évalue s'ils
   correspondent à la réalité surf pour le spot ciblé.

7. **Arrondi incohérent** :
   Le score est-il arrondi de la même façon partout ?
   `Math.round` vs `toFixed(1)` vs `parseInt` utilisés de manière mélangée ?

---

### AGENT 2 — Détecteur de Contradictions Conseil/Score

Trace la correspondance entre valeur numérique du score et message affiché.

**Vérifications :**

1. Reconstitue la matrice complète score → label → couleur → emoji → conseil :
   ```
   Score | Label       | Couleur | Emoji | Conseil affiché
   0-2   | ?           | ?       | ?     | ?
   3-4   | ?           | ?       | ?     | ?
   5-6   | ?           | ?       | ?     | ?
   7-8   | ?           | ?       | ?     | ?
   9-10  | ?           | ?       | ?     | ?
   ```

2. Cherche les contradictions :
   - Score > 7 avec conseil négatif
   - Score < 4 avec conseil positif
   - Couleur verte avec label "Difficile"

3. Cherche les off-by-one sur les seuils :
   - `score >= 7` vs `score > 7` — fait une différence à 7.0 exactement
   - Que se passe-t-il à score = 5.0 exactement ? 

4. Les tips/conseils spécifiques (ex: "Idéal pour longboard") correspondent-ils
   aux vraies conditions numériques détectées ?

---

### AGENT 3 — Auditeur Unités & Conversions

Cherche tous les affichages de valeurs chiffrées et trace leurs unités.

**Checklist :**

```bash
# Trouve toutes les unités mentionnées
grep -rn "km/h\|knot\|mph\|m/s\|ft\|feet\|meter\|metre\|°C\|°F\|celsius\|fahrenheit" src/
grep -rn "toFixed\|Math.round\|parseInt\|parseFloat" src/
```

1. **Hauteur de vague** : toujours en mètres ? toujours en pieds ? mélangé ?
2. **Vitesse du vent** : km/h, nœuds, m/s — une seule unité partout ?
3. **Direction** : degrés 0-360 vs points cardinaux — conversion correcte ?
4. **Température** : Celsius uniquement ou conversion Fahrenheit ?
5. **Timestamps** : UTC stocké, heure locale affichée — conversion présente ?
6. **Période de houle** : secondes ? cohérent partout ?

Pour chaque mélange d'unités trouvé : rapport CALCUL sévère.

---

### AGENT 4 — Chasseur d'Erreurs Silencieuses

```bash
# Cherche les patterns dangereux
grep -n "catch\|\.catch" src/ -r --include="*.js" --include="*.jsx"
grep -n "console\.error\|console\.warn" src/ -r --include="*.js" --include="*.jsx"
grep -n "fetch(" src/ -r --include="*.js" --include="*.jsx"
```

**Vérifications :**

1. Chaque `fetch()` a-t-il un `.then(res => { if (!res.ok) throw ... })` ?
2. Les catch vides : `catch(e) {}` ou `catch(e) { console.error(e) }` sans update de state ?
3. États de loading jamais remis à `false` en cas d'erreur :
   ```js
   setLoading(true)
   const data = await fetchConditions() // si ça throw
   setLoading(false) // cette ligne ne s'exécute jamais
   ```
4. Timeouts absents sur les fetch API océan/météo
5. `undefined` et `null` passés silencieusement aux composants d'affichage

---

### AGENT 5 — Validateur de Données API

Reconstitue le schéma de données que l'app reçoit et vérifie chaque champ.

**Questions à répondre :**

1. Quelle API météo/océan est utilisée ? (Open-Meteo, Stormglass, Windy, Surfline ?)
2. Quels champs sont utilisés ? Liste exhaustive.
3. Pour chaque champ : que se passe-t-il s'il est `null` ou `undefined` ?
4. Le cache est-il invalidé correctement ? Quelle est la durée ?
5. Un surfeur qui ouvre l'app à 6h du matin voit-il les données de 6h ou celles de la veille ?
6. Les prévisions futures (J+1, J+2) utilisent-elles le même pipeline que les données du jour ?

```bash
grep -rn "localStorage\|sessionStorage\|cache\|Cache\|stale\|TTL\|expire" src/
grep -rn "REACT_APP_\|VITE_" src/ # variables d'environnement API keys
```

---

### AGENT 6 — Inspecteur UX Surf

Évalue l'expérience utilisateur d'un surfeur qui utilise l'app à 5h30 du matin
avant d'aller surfer, sur mobile, en 4G, avec les yeux mi-clos.

**Checklist :**

1. **Above the fold mobile** : score et conseil sont-ils visibles sans scroller ?
2. **Lisibilité des chiffres** : taille de police assez grande pour 5h30 du matin ?
3. **États vides** : que voit-on si aucune plage n'est sélectionnée ?
4. **Erreur réseau** : message clair ou écran blanc ?
5. **Cohérence des données affichées** : si le score est pour "maintenant", 
   l'horodatage est-il visible ?
6. **Prévision temporelle** : peut-on voir les conditions heure par heure ?
7. **Accessibilité** : les couleurs rouge/orange/vert passent-elles en daltonisme ?

```bash
# Cherche les états vides et d'erreur
grep -rn "undefined\|null\|loading\|error\|empty\|noData" src/ --include="*.jsx"
```

---

### AGENT 7 — Profiler de Performance

```bash
# Compte les useEffect et fetch au mount
grep -n "useEffect\|useCallback\|useMemo" src/ -r --include="*.js" --include="*.jsx"
grep -n "fetch(\|axios\." src/ -r --include="*.js" --include="*.jsx"
# Cherche les re-renders
grep -n "setState\|useState\|dispatch" src/ -r --include="*.js" --include="*.jsx"
```

**Vérifications :**

1. Combien de requêtes API au chargement initial ?
2. Y a-t-il des AbortController sur les fetch dans les useEffect ?
3. Les calculs de score sont-ils recalculés à chaque render ?
   → Devraient être dans `useMemo`
4. La vidéo de loading (`surfer2.mp4`) bloque-t-elle le rendu de l'app ?
5. Les images de plage (si présentes) sont-elles lazy-loaded ?
6. `console.log` oubliés en production ?

```bash
grep -rn "console\.log" src/ --include="*.js" --include="*.jsx"
```

---

## PHASE 3 — RAPPORT STRUCTURÉ

Après audit complet, produis le rapport dans ce format :

```
========================================
SHOULD YOU SURF? — RAPPORT D'AUDIT
Date : [aujourd'hui]
Fichiers lus : [nombre]
Problèmes trouvés : [total]
========================================

SECTION 1 : PROBLÈMES BLOQUANTS
[liste avec format standard]

SECTION 2 : ERREURS DE CALCUL
[liste avec format standard]

SECTION 3 : INCOHÉRENCES CONSEIL/SCORE
[matrice complète + problèmes trouvés]

SECTION 4 : DÉGRADATIONS UX
[liste avec format standard]

SECTION 5 : PERFORMANCE
[liste avec format standard]

SECTION 6 : ERREURS SILENCIEUSES
[liste avec format standard]

========================================
TOP 5 FIXES PRIORITAIRES
========================================

| # | Fix | Sévérité | ~Temps | Impact surfeur |
|---|-----|----------|--------|----------------|
| 1 | ... | BLOQUANT | 30min  | ...            |
| 2 | ... | CALCUL   | 45min  | ...            |
...

========================================
3 QUICK WINS (< 15 min chacun)
========================================
1. ...
2. ...
3. ...

========================================
RECOMMANDATION ARCHITECTURE SCORE
========================================
[Si la logique de score est à refactoriser, propose ici une architecture propre :
- fichier scoreConfig.js avec tous les poids et seuils documentés
- fonction pure computeScore(conditions) → testable
- fichier scoreMessages.js avec la matrice label/couleur/conseil]
```

---

## PHASE 4 — GÉNÉRATION DES PROMPTS DE FIX

Pour chaque problème du Top 5 + les 3 quick wins, génère un prompt Claude Code
directement collable, dans ce format :

```
========================================
PROMPT FIX #[N] — [TITRE]
========================================

# Sprint Fix #[N] — [Titre court]

## Contexte projet
- App : "Should You Surf?" — React + Vite, branche `v2`
- Objectif : [1 phrase]
- Fichiers à modifier : [liste]

## Problème exact
[Description technique précise]
[Fichier:ligne]
[Code problématique]

## Ce que tu dois faire
1. [Action précise]
2. [Action précise]
3. Vérifier que `npm run build` passe sans erreur

## Ce que tu NE dois PAS toucher
- /public/assets/surfer2.mp4
- La palette de couleurs (bleu + cyan néon)
- Les fonts (Playfair Display, Raleway Light)

## Contraintes projet
- Stack : React + Vite uniquement
- Branche : v2
- Chaque calcul de score doit avoir un commentaire "// Pourquoi : [logique surf]"
- Push sur v2 uniquement, pas sur main

## Critères de validation
- [ ] [Comportement attendu avec valeurs de test précises]
- [ ] Score entre 0 et 10 dans tous les cas
- [ ] Conseil cohérent avec le score affiché
- [ ] npm run build : 0 erreurs, 0 warnings critiques
- [ ] Pas de console.log restant
```

---

## CONTRAINTES GLOBALES À RESPECTER

- Ne pas toucher à `surfer2.mp4` ni à la structure du loading screen
- Conserver la palette bleu + cyan néon et le style low-poly
- Branche de travail : `v2` uniquement
- Pas de push sur `main` sans validation explicite de Louis
- Chaque modification de calcul de score doit être accompagnée d'un commentaire
  expliquant la logique surf réelle (ex: `// Offshore wind = smoother wave face`)
- `npm run build` doit passer sans erreur avant tout commit
