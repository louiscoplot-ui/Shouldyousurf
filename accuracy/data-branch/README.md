# Forecast accuracy log (data only)

This branch holds the daily accuracy log written by the GitHub Actions workflow `.github/workflows/accuracy-daily-log.yml`. It has no shared history with `main` and contains no app code. **Never merge it.** `vercel.json` here turns Vercel deployments off for this branch.

Tooling and documentation: the `accuracy/` folder on the code branch.

## Layout

| Path | Content |
|---|---|
| `log/forecast/YYYY-MM.jsonl` | What the app predicted for each Australian break over the next 72 h, frozen at run time (swell, face height, wind, tide, score and verdict per level) |
| `log/model/YYYY-MM.jsonl` | Open-Meteo marine forecast at each offshore reference buoy's own position |
| `log/obs/YYYY-MM.jsonl` | Buoy measurements averaged to the hour (merged: one row per site and hour) |
| `log/runs.jsonl` | One summary line per run: counts, errors, app version |

All times are UTC.

## Data credits

- **Wave buoy observations:** IMOS / Australian Ocean Data Network (AODN) and the contributing buoy operators, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Dataset: *Wave buoys Observations - Australia - near real-time* (https://registry.opendata.aws/aodn_wave_buoy_realtime_nonqc/).
- **Weather and marine forecasts:** [Open-Meteo](https://open-meteo.com), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
