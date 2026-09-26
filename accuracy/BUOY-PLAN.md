# Buoy validation plan

**Status: plan only.** Nothing below runs on a schedule yet, and nothing touches the app. The inventory and mapping scripts (`npm run buoys`, `npm run map`) are read-only research tools. The daily logger in section 3 waits for your OK.

Goal: for every break, measure how far the forecast is from what the ocean actually did, so accuracy becomes a number per break instead of an impression from Trigg.

## 1. Data sources

### Australia: one source covers all the state networks

The **AODN National Wave Archive** (IMOS / Australian Ocean Data Network) already collects the buoys of every state operator into one dataset. The near-real-time copy is a public S3 bucket on AWS Open Data, with no key or account.

| | |
|---|---|
| Dataset | *Wave buoys Observations - Australia - near real-time* |
| Access | `https://aodn-cloud-optimised.s3.ap-southeast-2.amazonaws.com/wave_buoy_realtime_nonqc.parquet/` (Parquet, partitioned by site and month) |
| Licence | **CC BY 4.0** (from the AWS registry entry). Attribution is required: the registry gives the exact citation text (operators, year, title, URL, access date). |
| Contributors | WA Dept of Transport, QLD Dept of Environment and Science, MHL NSW, Bureau of Meteorology, IMOS, Gippsland Ports, UWA, Deakin, Flinders/SARDI, Pilbara Ports |
| Fields | `WSSH` or `WHTH` (significant height), `WPPE` (peak period), `WPDI` (peak direction), `WMXH` (max height), position, depth, QC flag |

**Verified from this session, 26/09/2026** (no guesses in this table):
- I read the bucket directly. It has **143 site folders**, and **73 buoys** reported in the last 7 days: DES-QLD 13, IMOS 21, UWA 10, Deakin 8, DoT-WA 7, MHL 7, SA-DEW 5, Flinders 1, Gippsland Ports 1. The list is in `data/buoys-au.json`.
- Rottnest (WMO **56005**) at 06:00 UTC: 2.65 m, 16.7 s, from 252°. Cottesloe is WMO **56008**. Both match the IDs already quoted in the comment in `breaks.js`.
- DoT-WA, MHL and DES-QLD rows are hours old. **The IMOS, UWA and Deakin rows in this copy stopped on 21/09**, so the logger must backfill a few days rather than read "yesterday" only.

**Why not the operator websites directly.** `transport.wa.gov.au`, `mhl.nsw.gov.au` and `data.qld.gov.au` are all blocked from this session, so I couldn't read their terms myself. Search results say Queensland publishes under CC BY 4.0 (with CSV/API on its open-data portal) and MHL under a Creative Commons Attribution licence through Data.NSW. I found no licence text for the WA DoT website. AODN solves all three at once: one format, one licence, redistributed with the operators' agreement. **Recommendation: use AODN only.**

### International

| Source | Covers | Access | Terms | Verified? |
|---|---|---|---|---|
| **NOAA NDBC** | US, Hawaii, US territories, some partner buoys | `https://www.ndbc.noaa.gov/data/realtime2/<station>.txt` (last 45 days, plain text, no key); station list `activestations.xml` | US government data, described as public domain | **No.** `ndbc.noaa.gov` is blocked from this session. The URL format and 45-day window come from search results quoting NDBC's own FAQ. The mapping of the 12 US breaks to stations is still to do. |
| Other national networks (France CANDHIS, Spain Puertos del Estado, UK Cefas WaveNet, Ireland Marine Institute, and others) | 21 other countries, 72 breaks | unknown | unknown | **Not researched.** I didn't want to put names or endpoints in a plan without checking them. Proposed next step if you want international coverage beyond the US. |

**Excluded as requested:** Surfline, Swellnet, Coastalwatch.

## 2. Break → buoy mapping (Australia)

Each break gets **two** buoys, because they answer two different questions:

- **Offshore reference (≥ 40 m depth): is the model right?** We compare Open-Meteo *at the buoy's own position* with what the buoy measured. Distance to the break matters less here, because we query the model where the buoy is.
- **Nearshore (< 40 m): what reaches the coast?** We compare the app's prediction for the break with the closest buoy that sees the same swells.

Ranking rule (`scripts/map-breaks.mjs`):
1. Same exposure: the buoy's open-ocean window must overlap the break's by at least 50%.
2. Then distance, with a 30% penalty when the straight line crosses land.

The grade is *good* (≤ 30 km, same window, over water), *fair* (≤ 80 km) or *weak*. A *weak* pairing is too far or too differently exposed to judge the break.

Snapshot from 26/09/2026. `npm run map` regenerates `data/break-buoys.md`.

| Break | Offshore reference (≥ 40 m) | Nearshore (< 40 m) |
|---|---|---|
| Trigg Beach | Rottnest Island · DOT-WA 56005 · **41.1 km** · 48 m · crosses land · *fair* | HILLARYS · IMOS · **10.5 km** · 28 m · *good* |
| Scarborough | Rottnest Island · DOT-WA 56005 · **40.6 km** · 48 m · *fair* | HILLARYS · IMOS · **11.3 km** · 28 m · *good* |
| Cottesloe | Rottnest Island · DOT-WA 56005 · **35.2 km** · 48 m · *fair* | Cottesloe · DOT-WA 56008 · **7 km** · 17 m · *good* |
| Leighton | Rottnest Island · DOT-WA 56005 · **33.6 km** · 48 m · *fair* | Cottesloe · DOT-WA 56008 · **8.2 km** · 17 m · *good* |
| Margaret River Main | Cape Naturaliste · DOT-WA 56006 · **53.1 km** · 50 m · *fair* | BUNBURY · IMOS · **80.4 km** · 29 m · crosses land · *weak* |
| Yallingup | Cape Naturaliste · DOT-WA 56006 · **23.9 km** · 50 m · *good* | BUNBURY · IMOS · **51.1 km** · 29 m · crosses land · *fair* |
| Gnaraloo (Tombstones) | — | CORAL-BAY-0-2 · IMOS · **79.9 km** · 31 m · crosses land · *fair* |
| Bondi Beach | Sydney · MHL 55024 · **19.4 km** · 90 m · *good* | COLLAROY-NARRABEEN · IMOS · **18.5 km** · 14 m · crosses land · *fair* |
| Manly | Sydney · MHL 55024 · **11.6 km** · 90 m · *good* | COLLAROY-NARRABEEN · IMOS · **8 km** · 14 m · crosses land · *fair* |
| North Narrabeen | Sydney · MHL 55024 · **10.6 km** · 90 m · crosses land · *fair* | COLLAROY-NARRABEEN · IMOS · **2.5 km** · 14 m · *good* |
| The Pass (Byron) | Byron Bay · MHL 55017 · **26.6 km** · 62 m · crosses land · *fair* | Tweed Heads · DES-QLD 55037 · **50.8 km** · 25 m · *fair* |
| Lennox Head | Byron Bay · MHL 55017 · **11.9 km** · 62 m · *good* | Tweed Heads · DES-QLD 55037 · **68.3 km** · 25 m · crosses land · *fair* |
| Crescent Head | Crowdy Head · MHL 55019 · **71.3 km** · 79 m · crosses land · *fair* | — |
| Angourie | Byron Bay · MHL 55017 · **74.8 km** · 62 m · *fair* | WOOLI · IMOS · **41.8 km** · 30 m · crosses land · *fair* |
| Snapper Rocks | Tweed Offshore · DES-QLD 55057 · **14.1 km** · 60 m · *good* | Tweed Heads · DES-QLD 55037 · **3.3 km** · 25 m · *good* |
| Kirra | Tweed Offshore · DES-QLD 55057 · **15.4 km** · 60 m · crosses land · *fair* | Tweed Heads · DES-QLD 55037 · **4.7 km** · 25 m · crosses land · *fair* |
| Burleigh Heads | Tweed Offshore · DES-QLD 55057 · **26.2 km** · 60 m · crosses land · *weak* | Palm Beach · DES-QLD 55050 · **2.9 km** · 24 m · crosses land · *weak* |
| Duranbah (D'Bah) | Tweed Offshore · DES-QLD 55057 · **13.8 km** · 60 m · *good* | Tweed Heads · DES-QLD 55037 · **3 km** · 25 m · *good* |
| Noosa (First Point) | Wide Bay · DES-QLD 55056 · **69.1 km** · 45 m · crosses land · *fair* | Mooloolaba · DES-QLD 55030 · **22.6 km** · 32 m · crosses land · *fair* |
| Alexandra Headland | Wide Bay · DES-QLD 55056 · **100.7 km** · 45 m · crosses land · *weak* | Mooloolaba · DES-QLD 55030 · **13.6 km** · 32 m · *good* |
| Bells Beach | INVERLOCH · VIC-DEAKIN-UNI · **136.7 km** · 51 m · *weak* | APOLLO-BAY · IMOS · **64.8 km** · 30 m · crosses land · *fair* |
| Winkipop | INVERLOCH · VIC-DEAKIN-UNI · **136.3 km** · 51 m · *weak* | APOLLO-BAY · IMOS · **64.8 km** · 30 m · crosses land · *fair* |
| Jan Juc | INVERLOCH · VIC-DEAKIN-UNI · **136.7 km** · 51 m · *weak* | APOLLO-BAY · IMOS · **66.6 km** · 30 m · crosses land · *fair* |
| Middleton | — | VICTOR-HARBOUROFFSHORE · SA-FLINDERS · **12.3 km** · 32 m · crosses land · *fair* |
| Waitpinga | NORTH-KANGAROO-ISLAND · IMOS · **148.4 km** · 45 m · crosses land · *weak* | VICTOR-HARBOUROFFSHORE · SA-FLINDERS · **7.7 km** · 32 m · *good* |
| Shipstern Bluff | — | STORM-BAY · IMOS · **24 km** · 38 m · crosses land · *fair* |
| Clifton Beach | — | STORM-BAY · IMOS · **26 km** · 38 m · crosses land · *weak* |

What it shows:
- **Good nearshore coverage:** Perth metro, North Narrabeen, the Tweed/Gold Coast group, Alexandra Headland, Waitpinga.
- **Offshore only, or distant:** Margaret River, Yallingup, Lennox, Angourie, Crescent Head (Crowdy Head is 71 km away).
- **No usable buoy:**
  - Bells, Winkipop and Jan Juc: Apollo Bay is 65 km away, and Inverloch is 137 km away on the far side of Port Phillip.
  - Gnaraloo: the only candidate is Coral Bay, 80 km away and behind land.
  - Shipstern and Clifton: Storm Bay buoy, which crosses land.
- Burleigh's pairing is unreliable until its coordinates are fixed (see `break-audit.md`).

## 3. Proposed daily log (not built)

### What gets recorded

One row per **break × hour × forecast lead time**, written once a day:

| Field | Source |
|---|---|
| `break_id`, `valid_time` (UTC), `lead_h` (0, 24, 48) | |
| `model_hs`, `model_tp`, `model_dir` at the **offshore buoy position** | Open-Meteo Marine, total `wave_height` + period + direction |
| `app_swell_h`, `app_swell_p`, `app_swell_dir`, `app_face_ft`, `app_score_{level}`, `app_verdict_{level}` for the **break** | the app's own code (`prodScoring.js`), run on the same Open-Meteo data the app would fetch |
| `buoy_off_hs/tp/dir`, `buoy_near_hs/tp/dir` | AODN, averaged to the hour |
| `buoy_face_ft` | nearshore buoy Hs run through the app's own `estimateFaceHeight` (same attenuation), so height is compared in the app's own unit |
| `field_note` (optional) | your session reports; the only way to check a *score* or a *verdict*, since no buoy measures "fun" |

### How the data flows

```
day D, 00:00 UTC   forecast for D, D+1, D+2 frozen and written   (prediction BEFORE the event)
day D+3            AODN observations for D fetched (7-day backfill for late IMOS rows)
                   rows joined on break + hour, written to log/YYYY-MM.jsonl
weekly             stats per break and per lead time -> report
```

The forecast must be saved **before** the event, never re-fetched afterwards. Open-Meteo returns updated runs, and a forecast re-read after the fact looks better than the one users actually saw.

### Storage

`accuracy/log/YYYY-MM.jsonl`, append-only, one JSON object per line. That's 27 breaks × 24 h × 3 lead times, about 2,000 rows/day and roughly 15 MB/month uncompressed. Plain files, no database, easy to diff and re-analyse.

### Statistics (after 4-6 weeks)

- Per break and per lead time: **bias** (mean error, "we over-call by 20%"), **MAE**, **RMSE**, **scatter index** (RMSE / mean observed), **circular** direction error, period error.
- Split in two: **model error** (offshore buoy vs model at the same point) and **transformation error** (nearshore buoy vs the app's break prediction). A break with a small model error and a large transformation error has a config problem (`swellAttenuation`, direction, sample point), not a data-source problem.
- **Why wait 4-6 weeks:** hours from the same swell are strongly correlated, so a week of data is effectively only a few independent events. We need several distinct swells and wind regimes per break.

### Where it would run (your call)

The Open-Meteo and NDBC hosts are blocked in these cloud sessions, so the logger can't run here. The options:

1. **GitHub Actions scheduled workflow** that commits `log/` to a dedicated branch. Free, no server. It needs your OK, since this task excludes touching Actions.
2. Your laptop with a cron job. Simplest, but it stops when the laptop sleeps.
3. A small scheduled job elsewhere (Render/railway cron).

The Vercel prod project stays out of it.

Open-Meteo cost: about 54 small requests a day (27 breaks × offshore point + break). That's well inside the free tier, but the tier is **non-commercial** (see CLAUDE.md), which applies here too.

## 4. What could break

- **Buoys go offline** (Maria Island was off for repairs in 2024 per the registry). The logger must write `null`, never reuse an old reading, and the stats must count missing hours.
- **Site renames:** the bucket holds the same buoy under two names (e.g. `HILLARYS` / `Hillarys`, `Byron` / `Byron Bay`). Pair by WMO id or coordinates, not by name.
- **Unit and definition mismatch:** `WHTH` (zero-crossing H1/3, Waverider) vs `WSSH` (spectral Hm0, Spotter) vs Open-Meteo `wave_height` (model Hm0). They typically differ by a few percent. That's textbook, not measured here. Log which one was used.
- **Buoy QC:** this is the *non-QC* real-time feed. Spikes and flat-lines happen. The `WAVE_quality_control` flag exists, but I haven't confirmed what its values mean.
- **The app changes:** the log records the app's version (`CACHE_V` / git SHA), so a scoring change doesn't mix into the stats silently.
- **Timezones:** everything in UTC in the log; local time only in reports.
- **S3 layout changes:** AODN is "cloud optimised" and still evolving. The client is isolated in `lib/aodn.mjs` so there's one place to fix.

## 5. Decisions for you

1. OK to build the logger with AODN for Australia + NDBC for the US, starting with the 27 AU breaks?
2. Where it runs (option 1, 2 or 3 above).
3. Whether to research the other international networks now or after Australia works.
4. Whether to log your own session notes alongside (the only ground truth for score and verdict).

Sources: [AWS registry entry](https://registry.opendata.aws/aodn_wave_buoy_realtime_nonqc/) ([YAML read directly](https://github.com/awslabs/open-data-registry/blob/main/datasets/aodn_wave_buoy_realtime_nonqc.yaml)) · [Data.gov.au: National Wave Archive](https://data.gov.au/data/dataset/wave-buoys-observations-australia-delayed-national-wave-archive) · [QLD Coastal Data System, near real time](https://www.data.qld.gov.au/dataset/coastal-data-system-near-real-time-wave-data) · [Data.NSW: NSW Ocean Wave Data Collection Program](https://data.nsw.gov.au/data/dataset/nsw-ocean-wave-data-collection-program) · [Transport WA wave data](https://www.transport.wa.gov.au/marine/charts-warnings-current-conditions/coastal-data-charts/wave-data) · [NDBC real-time data access FAQ](https://www.ndbc.noaa.gov/faq/rt_data_access.shtml) · [IMOS: national picture of coastal waves](https://imos.org.au/news/building-a-national-picture-of-australias-coastal-waves)
