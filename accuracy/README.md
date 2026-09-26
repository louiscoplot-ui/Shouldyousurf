# accuracy/

Tools to measure how accurate the forecast is, break by break.

**Standalone.** Own `package.json` and `node_modules`. The Next.js app, Vercel, `vercel.json` and GitHub Actions never import anything from here. It only **reads** `app/breaks.js` (the break list). It never writes to the app.

## Files

| File | What it is |
|---|---|
| `break-audit.md` | **Part 1 report.** Every AU break: config vs coastline geometry, a table, and a "needs review" list. Generated. |
| `BUOY-PLAN.md` | **Part 2 plan.** Buoy data sources, terms, break → buoy mapping, and the proposed daily log. Nothing in it runs yet. |
| `WORKFLOW-PLAN.md` | Plan for running the daily log on GitHub Actions: schedule, path to `main`, where logs are stored, limits, risk and rollback. Awaiting approval. |
| `BREAK-TYPES.md` | What `type` / `heavy` change in the engine, and a proposed type for the 14 untyped AU breaks. Report only. |
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

## Data attribution and licences

### Wave buoy data: IMOS / AODN (CC BY 4.0)

Wave buoy observations: **IMOS / Australian Ocean Data Network (AODN) and the contributing buoy operators**, licensed under the [Creative Commons Attribution 4.0 International licence (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Anything published from this data (a report, a chart, the app) must carry this credit and a link to the licence.

Dataset: *Wave buoys Observations - Australia - near real-time* ([AWS Open Data registry](https://registry.opendata.aws/aodn_wave_buoy_realtime_nonqc/), [metadata record](https://catalogue-imos.aodn.org.au/geonetwork/srv/eng/catalog.search#/metadata/b299cdcd-3dee-48aa-abdd-e0fcdbb9cadc)).

Citation, in the form the dataset's registry entry asks for:

> Department of Transport [W.A]; State of Queensland, Department of Environment and Science; Australian Bureau of Meteorology; Department of Planning and Environment (DPE), New South Wales Government; Gippsland Ports; Integrated Marine Observing System; University of Western Australia (UWA); Deakin University, Pilbara Ports Authority, Flinders University and South Australian Research and Development Institute (SARDI) [2026], Wave buoys Observations - Australia - near real-time, https://registry.opendata.aws/aodn_wave_buoy_realtime_nonqc/, accessed 26 September 2026.

Update the year and access date when data is re-downloaded. No changes are made to the observations beyond averaging to the hour; any derived statistics are ours, not IMOS/AODN's.

### Other data

- **Coastline:** © OpenStreetMap contributors, ODbL (via `@geo-maps/earth-lands-10m`). Used locally for geometry only, never redistributed.
- **Weather and marine forecasts** (future daily log): [Open-Meteo](https://open-meteo.com), CC BY 4.0, free tier for non-commercial use.
