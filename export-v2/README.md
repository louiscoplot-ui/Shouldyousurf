# Should You Surf — Redesign v2

Prototype HTML du redesign de la page spot. Tourne en statique, pas de build.

## Fichiers

- `index.html` — page principale, charge tout le reste
- `v2.css` — tous les styles + 5 thèmes (via `data-theme` sur `<html>`)
- `v2-shared.jsx` — helpers, constantes, hooks partagés
- `v2-parts.jsx` — sous-composants (hero, metric cards, tide, hourly list, etc.)
- `v2-main.jsx` — composant racine + montage React
- `mock.js` — données de forecast mockées (à remplacer par l'API réelle)

## Lancer en local

Ouvre `index.html` via un petit serveur statique (pas `file://`, Babel doit pouvoir charger les `.jsx`) :

```bash
npx serve .
# ou
python3 -m http.server 8000
```

## Thèmes

5 thèmes définis en CSS vars dans `v2.css`. Toggle via le picker en haut à droite, ou directement : `<html data-theme="bone">` (bone / slate / sand / mist / ink).

## Intégration Next.js

Pour porter dans l'app prod :
1. Créer une route `/spot/[slug]/v2` qui sert cette page
2. Convertir les `<script type="text/babel">` en vrais `.tsx`
3. Remplacer `mock.js` par un fetch vers l'API forecast réelle
4. Garder la structure CSS + les 5 thèmes tels quels

Ne pas toucher à la route prod actuelle — faire vivre v2 en parallèle sur une branche `redesign-v2`, push, laisser Vercel générer une preview URL.
