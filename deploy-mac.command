#!/bin/bash
set -e

cd "$(dirname "$0")"

echo ""
echo "  ===================================="
echo "     AUSSIE SURF - AUTO DEPLOY"
echo "  ===================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "  [X] Node.js n'est pas installé."
    echo ""
    echo "  Télécharge-le ici : https://nodejs.org"
    echo "  Installe la version LTS, puis relance ce script."
    echo ""
    read -n 1 -s -r -p "Appuie sur une touche pour fermer..."
    exit 1
fi

echo "  [OK] Node.js detecté: $(node --version)"
echo ""
echo "  [1/3] Installation des dépendances..."
npm install --no-audit --no-fund

echo ""
echo "  [2/3] Vérification du build..."
npm run build

echo ""
echo "  [3/3] Déploiement sur Vercel..."
echo ""
echo "  Si c'est ta première fois, Vercel va :"
echo "    - Ouvrir ton navigateur pour te connecter"
echo "    - Te poser quelques questions (accepte les défauts)"
echo ""
read -n 1 -s -r -p "  Appuie sur Entrée pour continuer..."
echo ""

npx vercel --yes || npx vercel

echo ""
echo "  ===================================="
echo "     DÉPLOIE EN PRODUCTION"
echo "  ===================================="
npx vercel --prod --yes

echo ""
echo "  ===================================="
echo "     TERMINÉ !"
echo "  ===================================="
echo ""
echo "  Ton app est en ligne. Copie l'URL ci-dessus,"
echo "  ouvre-la dans Safari sur ton iPhone,"
echo "  puis Partager -> Sur l'écran d'accueil."
echo ""
read -n 1 -s -r -p "Appuie sur une touche pour fermer..."
