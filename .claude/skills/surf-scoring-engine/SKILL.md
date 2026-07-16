---
name: surf-scoring-engine
description: Expert en physique des vagues et scoring surf mondial. Utiliser quand on améliore le scoring, recalibre les seuils, ou construit une formule précise.
---

# Surf Scoring Engine

## Règle absolue — LA TAILLE EST SOUVERAINE
Période + vent + direction + marée ajustent DANS la bande de taille. Jamais au-dessus.
Maximum combiné de tous les bonus hors-taille : +35% du baseSizeScore.

## Seuils surfabilité absolus
faceHeight < 0.2m   → pas surfable. Personne. Score = 0-8.
faceHeight 0.2-0.4m → whitewash first_timer uniquement. Score max 18.
faceHeight 0.4-0.6m → petit mais surfable beginner. Score max 35.
faceHeight 0.6-1.0m → beginner/early_int territoire.
faceHeight 1.0-1.5m → early_int/intermediate territoire.
faceHeight 1.5-2.2m → intermediate/advanced territoire.
faceHeight 2.2-3.0m → advanced/expert territoire.
faceHeight 3.0m+    → expert big wave. beginner/early_int = danger mortel.

## Grille baseSizeScore par niveau
FIRST_TIMER : <0.2m→5 | 0.2-0.4m→peak 35-65 | 0.4-0.6m→20-35 | 0.6-0.8m→8-18 | >0.8m→5
BEGINNER    : <0.25m→5 | 0.25-0.45m→25-42 | 0.45-0.75m→peak 55-75 | 0.75-1.0m→28-48 | 1.0-1.3m→12-25 | >1.3m→5
EARLY_INT   : <0.35m→5 | 0.35-0.55m→10-22 | 0.55-0.85m→38-58 | 0.85-1.25m→peak 65-82 | 1.25-1.55m→38-58 | 1.55-1.85m→15-32 | >1.85m→5
INTERMEDIATE: <0.5m→8 | 0.5-0.8m→22-38 | 0.8-1.2m→42-62 | 1.2-1.8m→peak 68-87 | 1.8-2.5m→42-62 | >2.5m→22-38
ADVANCED    : <0.8m→8 | 0.8-1.2m→18-30 | 1.2-1.8m→38-58 | 1.8-2.5m→peak 68-85 | 2.5-3.5m→75-92 | >3.5m→55-72
EXPERT      : <1.0m→12 | 1.0-1.8m→28-52 | 1.8-2.5m→58-75 | 2.5-3.5m→peak 78-92 | 3.5-5.0m→82-96 | >5.0m→88

## Multiplicateurs période
<6s→×0.62 | 6-8s→×0.80 | 8-10s→×0.95 | 10-12s→×1.12 | 12-14s→×1.25 | 14-16s→×1.35 | 16s+→×1.42

## Multiplicateurs vent (angle vs offshore idéal du spot)
Offshore <10km/h→×1.30 | Offshore 10-20→×1.20 | Offshore 20-30→×1.10
Cross <10→×1.05 | Cross 10-20→×0.90 | Cross >20→×0.75
Onshore <10→×0.72 | Onshore 10-20→×0.58 | Onshore 20-30→×0.45 | Onshore >30→×0.30 + score plafonné 15

## Multiplicateurs direction swell vs spot
delta 0-20°→×1.22 | 20-40°→×1.10 | 40-60°→×0.95 | 60-80°→×0.75 | 80-100°→×0.50 | >100°→×0.25

## Sécurité absolue inviolable
Minimum faceHeight (en dessous = score 5, SKIP forcé) :
  first_timer:0.15m | beginner:0.25m | early_int:0.35m | intermediate:0.5m | advanced:0.8m | expert:1.0m

Maximum faceHeight (au-dessus = score 8, SKIP forcé) :
  first_timer:0.7m | beginner:1.2m | early_int:1.85m | intermediate:2.8m | advanced:4.0m | expert:sans limite

Onshore >35km/h → SKIP tous niveaux.
Multiplicateurs combinés plafonnés : max ×2.0, min ×0.40.

## 5 cas terrain de validation
A : 0.3m/8s/offshore 10  → score MAX 12 tous niveaux SAUF first_timer (whitewash 0.2-0.4m = SA zone d'apprentissage, grille dédiée peak 35-65 — le cap micro-swell est par niveau et le laisse vivre), SKIP partout sauf first_timer GO
B : 0.7m/10s/offshore 15 → early_int 55-70, beginner 45-60
C : 1.2m/12s/offshore 12 → early_int 68-80, intermediate 72-85, beginner 20-30
D : 2.0m/14s/offshore 10 → advanced 82-92, early_int SKIP <20
E : 1.0m/7s/onshore 22   → tous niveaux max 25, personne GO
