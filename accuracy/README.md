# accuracy/

Tools to measure how accurate the forecast is, break by break.

**Standalone.** Own `package.json` and `node_modules`. The Next.js app, Vercel, `vercel.json` and GitHub Actions never import anything from here. It only **reads** `app/breaks.js` (the break list). It never writes to the app.

## Files

| File | What it is |
|---|---|
| `break-audit.md` | **Part 1 report.** Every AU break: config vs coastline geometry, a table, and a "needs review" list. Generated. |
| `BUOY-PLAN.md` | **Part 2 plan.** Buoy data sources, terms, break → buoy mapping, and the proposed daily log. Nothing in it runs yet. |
| `scripts/break-audit.mjs` | Builds the audit: reads `app/breaks.js`, analyses the coastline around each break, writes `break-audit.md` + `data/break-audit.json`. |
| `scripts/buoy-inventory.mjs` | Lists every AU buoy in the AODN real-time dataset (position, operator, WMO id, last report, fields) → `data/buoys-au.json`. |
| `scripts/map-breaks.mjs` | Picks an offshore and a nearshore buoy for each break → `data/break-buoys.json` + `data/break-buoys.md`. |
| `lib/geo.mjs` | Coastline geometry: facing direction, swell window, fetch, point-on-land test. Rays over OpenStreetMap land polygons. |
| `lib/aodn.mjs` | Read-only client for the AODN wave-buoy bucket on AWS (S3 listing + Parquet reading). |
| `data/*.json`, `data/*.md` | Snapshots from 26/09/2026, committed so the reports can be read without re-running anything. |

## Run

```bash
cd accuracy
npm install            # ~35 MB download: OSM coastline (135 MB unpacked) + Parquet reader
npm run audit          # Part 1 -> break-audit.md             (~10 s, offline)
npm run buoys          # buoy inventory -> data/buoys-au.json (~10 s, needs internet)
npm run map            # break -> buoy  -> data/break-buoys.* (~10 s, offline, after `buoys`)
COUNTRY=FR npm run audit   # any other country code from breaks.js
```

## How data flows

```
app/breaks.js ──┐
                ├─> break-audit.mjs ──> break-audit.md, data/break-audit.json
OSM coastline ──┤
(lib/geo.mjs)   └─> map-breaks.mjs ───> data/break-buoys.{json,md}
                          ^
AODN S3 bucket ──> buoy-inventory.mjs ──> data/buoys-au.json
(lib/aodn.mjs)
```

## Licences of the data used

- Coastline: © OpenStreetMap contributors, ODbL (via `@geo-maps/earth-lands-10m`). Only used locally, never redistributed.
- Buoys: AODN / IMOS and contributing operators, **CC BY 4.0**. Credit required if published (citation text in `BUOY-PLAN.md`).
