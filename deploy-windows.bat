@echo off
setlocal enabledelayedexpansion
title Aussie Surf - Auto Deploy

echo.
echo   ====================================
echo      AUSSIE SURF - AUTO DEPLOY
echo   ====================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   [X] Node.js n'est pas installe.
    echo.
    echo   Telecharge-le ici : https://nodejs.org
    echo   Installe la version LTS, puis relance ce script.
    echo.
    pause
    exit /b 1
)

echo   [OK] Node.js detecte
node --version

echo.
echo   [1/3] Installation des dependances...
echo   (peut prendre 1-2 minutes la premiere fois)
echo.
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo   [X] Erreur pendant npm install
    pause
    exit /b 1
)

echo.
echo   [2/3] Verification du build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo   [X] Erreur pendant le build
    pause
    exit /b 1
)

echo.
echo   [3/3] Deploiement sur Vercel...
echo.
echo   Si c'est ta premiere fois, Vercel va :
echo     - Ouvrir ton navigateur pour te connecter
echo     - Te poser quelques questions (accepte les defauts)
echo.
echo   Appuie sur Entree pour continuer...
pause >nul

call npx vercel --yes
if %errorlevel% neq 0 (
    echo.
    echo   Premier deploiement echoue. Lance le mode interactif...
    call npx vercel
)

echo.
echo   ====================================
echo      DEPLOIE EN PRODUCTION
echo   ====================================
echo.
call npx vercel --prod --yes

echo.
echo   ====================================
echo      TERMINE !
echo   ====================================
echo.
echo   Ton app est en ligne. Copie l'URL ci-dessus,
echo   ouvre-la dans Safari sur ton iPhone,
echo   puis Partager -^> "Sur l'ecran d'accueil".
echo.
pause
