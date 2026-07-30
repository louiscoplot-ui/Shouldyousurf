// Filet anti-"variable supprimée mais encore utilisée dans le JSX".
//
// `next build` NE VOIT PAS cette classe de bug : les composants v2 ne sont
// jamais rendus pendant la génération statique (MainScreen renvoie
// LoadingScreen tant que payload est null), donc un ReferenceError dans
// StickyInfoBar / HourlyList compile sans broncher et ne casse qu'en prod,
// à l'écran de l'utilisateur ("Application error: a client-side exception
// has occurred", page blanche). Arrivé le 27/07 avec `faceM`.
//
// Config volontairement minimale : UNE règle, no-undef. Pas de style, pas
// d'opinion — juste "ce symbole existe-t-il ?". À lancer avant tout push
// touchant un composant : `npm run lint:undef`.

// Stub : les composants portent des commentaires
// `eslint-disable-next-line react-hooks/exhaustive-deps`. Sans une définition
// de cette règle, ESLint échoue sur "Definition for rule not found" et le
// script sortirait TOUJOURS en erreur — le filet deviendrait inutilisable
// (un gate qui échoue tout le temps n'est plus lu par personne).
const reactHooksStub = { rules: { "exhaustive-deps": { create: () => ({}) } } };

export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: { "react-hooks": reactHooksStub },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly", document: "readonly", navigator: "readonly",
        localStorage: "readonly", console: "readonly", fetch: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly",
        clearInterval: "readonly", Notification: "readonly", AbortController: "readonly",
        URL: "readonly", URLSearchParams: "readonly", Intl: "readonly",
        requestAnimationFrame: "readonly", cancelAnimationFrame: "readonly",
        MutationObserver: "readonly", performance: "readonly", caches: "readonly",
        self: "readonly", process: "readonly", alert: "readonly", Image: "readonly",
        Blob: "readonly", FileReader: "readonly", matchMedia: "readonly",
        location: "readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
];
