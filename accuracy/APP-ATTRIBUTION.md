# Open-Meteo attribution in the app: report

**Report only. Nothing in the app was changed.** Checked on `main` as of 26/09/2026.

## What Open-Meteo requires

From Open-Meteo's own licence page (read from its website source, `src/routes/en/licence/+page.svelte`):

- The API data is licensed **CC BY 4.0**: "You must give appropriate credit, provide a link to the licence, and indicate if changes were made."
- "**You must include a link next to any location Open-Meteo data are displayed**". Their example is `<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>`.

## What the app shows today

| Where | What | Link to open-meteo.com? | Link to CC BY 4.0? |
|---|---|---|---|
| Footer, bottom of the main screen (`app/v2/components/Footer.jsx:16`) | "marine data · open-meteo", translated in all 12 languages (`i18n.js`, key `footer`) | **No**, plain text | **No** |
| Footer disclaimer (`Footer.jsx`, key `disclaimer`) | "Forecast based on public weather APIs (Open-Meteo / ECMWF / GFS)…" | No | No |
| Help / FAQ (`faq_a9`) | "All data comes from Open-Meteo (open-meteo.com)…" | No (plain text domain) | No |
| Score, hourly cards, sheets | No credit next to the numbers | — | — |

## Gaps

1. **No link.** The credit exists but isn't a link to open-meteo.com, which the licence page asks for explicitly.
2. **No link to the CC BY 4.0 licence.**
3. **No "changes were made" notice.** The app transforms the data (face height, attenuation, scores, verdicts). CC BY asks to indicate that. A short "scores and face heights are our own calculations" next to the credit would cover it.
4. **Placement:** the credit is only at the very bottom of the page. The licence says "next to any location Open-Meteo data are displayed". A single footer credit is a common reading of "reasonable manner", but it's the weakest one.

## Suggested fix (for the separate config/app task, not done here)

Turn the footer line into links, e.g. `Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a> (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>) · scores and face heights calculated by Should You Surf?`. That's one component plus 12 translations. The free tier's **non-commercial** condition is a separate question, already noted in CLAUDE.md.

## Other findings

- `faq_a5` still says past days come from "the Open-Meteo archive API". `realFetch.js` now reads past days from the forecast API (see its comment on the ERA5 lag). The FAQ text is out of date, not the attribution.
