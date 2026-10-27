# 🌊 Should You Surf?

**[shouldyousurf.com](https://shouldyousurf.com)** — a surf check that answers one question: *is it worth driving to the beach right now, for my level?*

Most forecast apps show raw numbers (swell height, period, wind) and leave the interpretation to you. Should You Surf? turns them into an hour-by-hour score from 0 to 100 and a personal **GO / MAYBE / SKIP** verdict tuned to six surfer levels, from first-timer to expert.

## Features

- **Personal verdict per level** — six levels (`first_timer`, `beginner`, `early_int`, `intermediate`, `advanced`, `expert`), each with its own size, wind and current thresholds
- **Hourly score 0–100** over a 5-day forecast, with a breakdown sheet explaining how each score is built
- **Best window of the day** highlighted, so you know *when* to go, not just *whether*
- **120+ curated breaks across 23 countries** (Perth, Gold Coast, Hossegor, Pipeline, Bali, Jeffreys Bay, Nazaré…), plus free search for any beach worldwide
- **GPS** — picks the nearest curated break, or scores your exact position
- **Safety first** — danger banner for learners on strong currents and oversized surf
- **12 languages**, 5 colour themes, installable as a PWA (iOS and Android)

## How the scoring works

The engine lives in `app/v2/lib/prodScoring.js` and follows a few hard rules:

- **Fully continuous** — no step thresholds anywhere. Every table is interpolated and every safety cap is a ramp, so a 1 cm change in swell can never make the score jump. Continuity is enforced by tests.
- **Score and verdict are separate dimensions.** The verdict (`getPersonalVerdict`) is the single source of truth for GO / MAYBE / SKIP; the score can never display a label that contradicts it.
- **Global by design** — every spot parameter is derived from coordinates (offshore bearing, coastline orientation, ideal swell direction). Nothing depends on a local station or a buoy, so a beach in Peru is scored the same way as one in Perth.
- **Field-validated** — real sessions reported from the beach are encoded as regression tests (`tests/scoring.test.mjs`), so the engine can't silently drift away from conditions we know the answer to.

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 |
| Data | Open-Meteo Marine + Forecast APIs |
| Place search | Photon (OpenStreetMap), Open-Meteo geocoding fallback |
| Analytics | Vercel Web Analytics, PostHog, GA4 |
| Tests | Vitest |
| Hosting | Vercel (auto-deploys from `main`) |

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Before pushing:

```bash
npm test           # scoring, wind sampling, cache and place-search tests
npm run lint:undef # catches undefined variables the build doesn't see
npm run build
```

## Project structure

```
app/
  page.js              # entry point, renders the main screen
  breaks.js            # curated surf spots
  i18n.js              # translations (12 languages)
  v2/components/       # UI (MainScreen, HourlyList, ScoreSheet, LevelMatrix…)
  v2/lib/              # scoring engine, data fetching, verdict logic
tests/                 # Vitest suites + real-world fixtures
public/                # PWA assets
```

## Data & attribution

Forecast data from [Open-Meteo](https://open-meteo.com). Place search powered by [Photon](https://photon.komoot.io) using © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

> Should You Surf? is decision support, not a safety guarantee. Always check conditions on the beach and surf between the flags.
