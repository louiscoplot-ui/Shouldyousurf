# 🌊 Aussie Surf

Surf check app pour les plages d'Australie. Score 0-100 par heure, prévision 5 jours.

## 🚀 Déployer (3 minutes)

### Windows
1. Installer [Node.js LTS](https://nodejs.org) si pas déjà fait
2. **Double-cliquer sur `deploy-windows.bat`**
3. Suivre les instructions (connexion Vercel la 1ère fois)

### Mac
1. Installer [Node.js LTS](https://nodejs.org) si pas déjà fait
2. **Double-cliquer sur `deploy-mac.command`**
3. Si Mac refuse : clic droit → Ouvrir
4. Suivre les instructions

À la fin tu auras une URL type `aussie-surf-xxx.vercel.app`.

## 📱 Installer sur iPhone

1. Ouvrir l'URL dans **Safari** (pas Chrome)
2. Bouton Partager ⬆
3. Scroller → **"Sur l'écran d'accueil"**
4. Ajouter

L'app se lance fullscreen comme une vraie app native.

## ✨ Features

- 90+ breaks pré-chargés à travers 24 pays (Perth, Gold Coast, Sydney, Byron, Hossegor, Pipeline, Bali, Mundaka, Jeffreys Bay, Nazaré...)
- Recherche de n'importe quelle plage du monde via géocoding Open-Meteo
- Scoring adapté à chaque break (direction idéale de swell + vent offshore)
- Favoris sauvegardés
- Meilleure fenêtre du jour mise en avant
- Prévision horaire sur 5 jours
- Heures du dawn (5h-9h) marquées 🌅

## 🔧 Dev local

```bash
npm install
npm run dev
```

## 📊 Data

Open-Meteo Marine API + Forecast API (gratuit, pas de clé).
