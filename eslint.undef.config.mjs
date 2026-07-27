export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window:"readonly",document:"readonly",navigator:"readonly",localStorage:"readonly",
        console:"readonly",fetch:"readonly",setTimeout:"readonly",clearTimeout:"readonly",
        setInterval:"readonly",clearInterval:"readonly",Notification:"readonly",
        AbortController:"readonly",URLSearchParams:"readonly",Intl:"readonly",
        requestAnimationFrame:"readonly",caches:"readonly",self:"readonly",
        process:"readonly",alert:"readonly",Image:"readonly",Blob:"readonly",
        FileReader:"readonly",matchMedia:"readonly",location:"readonly",MutationObserver:"readonly",performance:"readonly",cancelAnimationFrame:"readonly",URL:"readonly",URLSearchParams:"readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
];
