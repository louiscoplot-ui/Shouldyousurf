# Daily accuracy log on GitHub Actions: plan

**Status (26/09/2026): approved and built on `feature/accuracy-audit`, in TEST PHASE.** Test runs write to `accuracy-data-test` only. Nothing touches `main`. Storage option A was chosen. The move to `main` (step 4 below) is yours to do, whenever you decide.

Scope: the 27 Australian breaks, AODN buoys (see `BUOY-PLAN.md`).

Every fact below marked *verified* was checked in this session against a primary source (GitHub's docs source, Open-Meteo's website source, Vercel's docs, or this project's Vercel deployment list). Anything else is marked as an assumption.

---

## 1. The change, in one paragraph

Add one GitHub Actions workflow that runs once a day. It:
1. saves the forecast the app would show for each break (and what Open-Meteo predicts at each offshore buoy),
2. downloads what the buoys actually measured over the previous days,
3. appends both to monthly log files on a dedicated data branch.

It never builds, deploys or edits the app.

## 2. The workflow file and its schedule

**File:** `.github/workflows/accuracy-daily-log.yml`. The repo has no `.github/` folder today, so there's no existing CI to disturb.

```yaml
name: Accuracy daily log
on:
  schedule:
    - cron: "17 21 * * *"     # 21:17 UTC = 05:17 Perth (AWST, UTC+8, no daylight saving)
  workflow_dispatch: {}        # "Run workflow" button, for tests and backfills
permissions:
  contents: write              # only to push the log commit to the data branch
concurrency:
  group: accuracy-daily-log
  cancel-in-progress: false    # never run two loggers at once
jobs:
  log:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<pinned SHA>              # code: main
      - uses: actions/checkout@<pinned SHA>              # data: accuracy-data branch, into ./log-branch
        with: { ref: accuracy-data, path: log-branch }
      - uses: actions/setup-node@<pinned SHA>
        with: { node-version: 22 }
      - run: npm ci --omit=dev
        working-directory: accuracy
      - run: node scripts/daily-log.mjs --out ../log-branch/log
        working-directory: accuracy
      - name: Commit the log to the data branch
        working-directory: log-branch
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add log
          git diff --cached --quiet || git commit -m "data: accuracy log $(date -u +%F)"
          git push origin HEAD:accuracy-data
```

**Why 05:17 Perth:**
- **Before dawn.** The forecast is frozen at the moment people check it before a dawn session, so we grade what users actually saw.
- **Not on the hour.** GitHub's docs say scheduled runs are often delayed at the start of the hour, and jobs can even be dropped under heavy load *(verified)*. Minute 17 avoids that.

A run can still start a few minutes late. The script stamps the real fetch time, so the stats aren't affected.

**Dependencies.** The coastline package (35 MB) is only needed for the audit, not for the daily log. It moves to `devDependencies`, and the workflow installs with `--omit=dev`.

### How it gets from `feature/accuracy-audit` to `main`

**A scheduled workflow only runs if its file is on the default branch** *(verified: "Scheduled workflows will only run on the default branch", GitHub docs)*. The same rule applies to the "Run workflow" button. So the file has to reach `main` at some point. Because I never merge or open pull requests, **that final step is yours.**

| Step | Who | Touches `main`? |
|---|---|---|
| 1. Write `daily-log.mjs` and the workflow on `feature/accuracy-audit`, plus a temporary `on: push` trigger for that branch only. A `push` trigger runs from an unmerged branch *(verified: "This includes workflows that are not merged into the default branch")*. | me | no |
| 2. Test runs on push. They write to a throwaway branch `accuracy-data-test`, not the real data branch. You check the output (section 6). | me + you | no |
| 3. Remove the temporary push trigger and point the output at `accuracy-data`. | me | no |
| 4. You open a pull request from `feature/accuracy-audit` into `main`, review it, and merge it. | **you** | yes, once |
| 5. From the next 21:17 UTC, the schedule runs by itself. | GitHub | no |

**The one unavoidable deploy.** Merging into `main` triggers **one** production Vercel deploy. The app code is unchanged, so it rebuilds the same site. `feature/accuracy-audit` was already built by Vercel as a preview today with `accuracy/` in it, and came out READY *(verified via the Vercel deployment list)*, so the extra folder doesn't break the build. After that, the daily runs never commit to `main`.

## 3. Where the daily logs live

They never go on `main`: every commit to `main` deploys production.

One fact changes the picture: **Vercel builds a preview for every push to *any* branch** *(verified twice)*:
- Vercel's docs: "Unspecified branches default to true".
- This project: today's pushes to `claude/promo-video-remotion-vg4z52` and `feature/accuracy-audit` each produced a preview deployment.

So "a separate branch" alone is not enough. A daily commit there would mean a daily Vercel build.

### Option A: orphan branch `accuracy-data` in this repo, with Vercel turned off for it (recommended)

An *orphan* branch shares no history with `main`. It holds only `log/`, a README with the data credits, and a `vercel.json` containing `{"git":{"deploymentEnabled":false}}`. That setting stops Vercel deploying *(verified in Vercel's docs)*. This `vercel.json` lives **only on the data branch**. The `vercel.json` on `main` (there is none today) is not touched.

- **Pros:**
  - No secret to create or renew; the built-in `GITHUB_TOKEN` is enough.
  - Everything stays in one repo, and the logs are one click away on GitHub.
  - Deleting the branch deletes the data.
- **Cons:**
  - **To verify on the first push:** I'm *assuming* Vercel reads `deploymentEnabled` from the `vercel.json` of the commit being pushed. The docs don't say which commit is read. If a preview still appears, the fallback is one setting in the Vercel dashboard: *Ignored Build Step* with `[ "$VERCEL_GIT_COMMIT_REF" = "accuracy-data" ] && exit 0 || exit 1`. That setting applies to production too, so it needs care.
  - The repo is **public** (its page loads without login), so the logs are public. That's fine for CC BY data with credit, but everyone can see your accuracy numbers.
  - The data grows by about 0.9 MB/day of raw text (measured on a full local run: forecast about 670 KB, model 116 KB, new buoy hours about 90 KB). That's roughly 27 MB/month before git compression, and JSON lines compress well.

### Option B: separate repository, e.g. `shouldyousurf-accuracy-data` (private or public)

- **Pros:**
  - No link to Vercel at all, so nothing to verify.
  - The data repo can be private.
  - The main repo's history stays clean.
- **Cons:**
  - Needs a **fine-grained personal access token** with *contents: write* on the data repo only, stored as the secret `ACCURACY_DATA_TOKEN`.
  - Tokens expire, and when they do the logger fails until you renew it.
  - A second repo to manage.

### Option C: GitHub Actions artifacts or release assets (not recommended)

- **Pros:** no commits anywhere.
- **Cons:**
  - Artifacts are deleted after a retention period. That's a problem for a log meant to accumulate over months. I didn't re-check the exact limit this session.
  - Release assets must be downloaded, appended and re-uploaded each day, so they're fragile and not diffable.

**Recommendation: A**, with the Vercel check as step 2's acceptance test. If a preview appears and you don't want to touch the dashboard, switch to B.

## 4. Secrets, keys and Open-Meteo limits

**Secrets needed for option A: none.**
- Open-Meteo's free tier has no key.
- The AODN bucket is public.
- The push uses the built-in `GITHUB_TOKEN`, limited to `contents: write` by the `permissions:` block.

Option B adds one secret (`ACCURACY_DATA_TOKEN`). A paid Open-Meteo plan later would add `OPEN_METEO_API_KEY`.

**Open-Meteo limits** *(verified from the open-meteo-website source, terms and pricing pages)*:
- Free, non-commercial: **600 calls/minute, 5,000/hour, 10,000/day, 300,000/month**.
- A request is weighed by its size: `max(1, variables ÷ 10 × time weight) × number of locations`. Each location in a multi-point request counts as its own call.

**One daily run:**

| Request | Locations | Variables | Calls |
|---|---|---|---|
| Marine forecast at each break's sample point (same 13 variables as the app) | 27 | 13 → 1.3 each | ≈ 35 |
| Wind/air forecast at each break (5 hourly + 2 daily) | 27 | 7 → 1 each | 27 |
| Marine forecast at each offshore reference buoy | 9 | 3 → 1 each | 9 |
| **Total (plan)** | | | **≈ 71 calls/day** |

**As built, it's about 133 calls/day (~4,000/month)**, still about 1.3% of each limit. The logger reuses the app's own `fetchRealForecast`, so it runs exactly the app's code. That function also requests the past 3 days (marine + wind) and a 5-day window, just as the app does, which roughly doubles the break requests. The runner's IP is GitHub's, not your users', so it doesn't eat into the app's own usage.

**Terms to keep in mind** *(verified)*:
- The free tier is **non-commercial only**.
- Open-Meteo data is **CC BY 4.0**, so the data branch README credits it next to IMOS/AODN.

This logger doesn't change the app's existing question about commercial use (see CLAUDE.md), but it runs on the same free tier.

## 5. Change / reason / risk / verification / rollback

### Change
- Adds `.github/workflows/accuracy-daily-log.yml`, `accuracy/scripts/daily-log.mjs`, and a `devDependencies` split in `accuracy/package.json`.
- Creates the orphan branch `accuracy-data`.
- Nothing in `app/`, `public/`, `next.config.mjs`, `package.json` (root) or Vercel settings.

### Reason
Forecast accuracy has only ever been judged by feel at Trigg. A daily, frozen-before-the-event log compared with measured buoy data gives per-break error numbers. It also separates model error (Open-Meteo is wrong) from config error (the break's direction, attenuation or sample point is wrong).

### Risks, and how each is contained

| Risk | Containment |
|---|---|
| `contents: write` could in theory push to **`main`** | The push names its target explicitly (`HEAD:accuracy-data`). Stronger: add a **branch ruleset on `main`** that blocks direct pushes (Settings → Rules). That's recommended anyway, since it also enforces the "never push to main" rule for everyone, me included. |
| A Vercel preview build every day on the data branch | Branch-local `vercel.json`, checked on the first push (section 3). |
| Silent failure (buoy down, API change, runner problem) | GitHub emails the person who last edited the cron line when a scheduled run fails *(verified: docs, "Notifications for scheduled workflows")*. The script also exits non-zero if fewer than 80% of rows got data, so a half-empty day is flagged too. |
| Scheduled workflow switched off after **60 days of no repo activity** (public repos) *(verified)* | I *assume* the daily commit to `accuracy-data` counts as activity. The docs don't define "activity". If it stops, re-enable with one click in the Actions tab. |
| Third-party action compromised | Actions pinned to full commit SHAs, not tags. `npm ci` from the lockfile. No secrets exist for option A, so there's nothing to leak. |
| Open-Meteo blocks the runner's IP or changes its API | Well under the limits (section 4). The script writes `null` and fails loudly rather than guessing. |
| The app's scoring changes and silently mixes into the stats | Every row stores the app's git SHA and `CACHE_V`, so stats can be split per engine version. |

### Verification before you merge (step 2)
1. The test run on push is green, and `accuracy-data-test` receives `log/2026-MM.jsonl`.
2. Row count is about 27 breaks × 24 h × 3 lead times, and fewer than 20% of rows have null buoy values.
3. Spot check: Rottnest rows match the AODN values for the same hours. I'll paste the comparison.
4. **No Vercel deployment exists for `accuracy-data-test`** (checked with the Vercel deployment list, filtered by branch).
5. `npm test` in the repo root still passes. It won't be affected, but the check is cheap.

### Verification after you merge
- Press "Run workflow" once in the Actions tab.
- The next morning, check that one new commit landed on `accuracy-data` and that **no new commit landed on `main`**.

### Rollback (fastest first)
1. **Pause:** Actions tab → *Accuracy daily log* → *Disable workflow*. Instant, no commit, no deploy.
2. **Remove:** delete `.github/workflows/accuracy-daily-log.yml` on `main`. You do it, and it costs one production deploy of an unchanged app.
3. **Erase data:** delete the `accuracy-data` branch (and the secret, for option B).

None of these touch the app, so a rollback can't break the site.

## 6. What I need from you

1. **OK to build**, on `feature/accuracy-audit` only, with test runs writing to `accuracy-data-test`.
2. **Storage choice:** A (recommended) or B.
3. Whether you'll add the **ruleset protecting `main`** (recommended, takes one minute in the GitHub settings).

---

## 7. Test results (26/09/2026)

Two runs, both triggered by pushes to `feature/accuracy-audit` and both writing to `accuracy-data-test`.

| Check | Result |
|---|---|
| Run 1 ([#1](https://github.com/louiscoplot-ui/Shouldyousurf/actions/runs/36238385333)): creates the orphan branch, real Open-Meteo + AODN data | ✅ success in 27 s. Forecast 27/27 breaks (1,377 rows), model 9/9 buoys (648 rows), buoys 21/21 sites (1,885 hours), 0 errors |
| Run 2: appends to the existing branch | ✅ forecast and model appended (2,754 / 1,296 rows), buoy rows merged without duplicates (0 added, 1,884 refreshed) |
| **Vercel preview for `accuracy-data-test`** | ✅ **none**, after both pushes (Vercel deployment list, filtered by branch and by time). The only deployments in that window are the expected previews of `feature/accuracy-audit` itself. *Cause not isolated:* either the branch's `vercel.json` or Vercel not deploying pushes made with the Actions token. The outcome is what matters, and it will be re-checked on the first `accuracy-data` push. |
| `main` untouched | ✅ still at `27bd0b5` |
| App tests (`npm test` at the root, vitest) | ✅ 158/158. The accuracy tests are named `*.nodetest.mjs` so vitest doesn't collect them (with `*.test.mjs` it failed with "No test suite found") |
| Accuracy tests (`npm test` in `accuracy/`) | ✅ 6/6 |

### Findings from real data

1. **Open-Meteo returns no peak period** (`wave_peak_period` is null at all 9 offshore buoys with `best_match`). Only the mean period and mean direction come back. The logger now also stores the buoy's **mean** period (`WPFM`/`WPMH`) and mean direction (`SSWMD`), so the comparison is mean against mean.
2. **Buoy coverage in the AODN real-time copy is very uneven** (hours logged over the last 7 days, out of 168):
   - NSW, QLD, SA and VIC: **131–167**, near complete.
   - IMOS: **36–39**, because their feed stopped on 21/09.
   - **WA Transport (Rottnest 6, Cape Naturaliste 12, Cottesloe 15)**: sparse snapshots, not an hourly series.

   So **Perth, Trigg included, currently has the weakest buoy truth of all**. Options, for a later decision:
   - wait for the AODN *delayed-mode* archive to fill in (unknown lag);
   - check whether Transport WA's own site publishes the full series and on what terms (blocked from this session);
   - lean on the IMOS Hillarys buoy for Trigg once its feed resumes.
3. The Actions token cannot write anywhere except where the script pushes. Your `main` ruleset (PR required) also blocks any direct push, so the workflow cannot touch `main` even by mistake.

### Before the move to `main` (your step 4)

- Remove the `push:` block marked "TEST PHASE ONLY" (I'll do it on request).
- Optionally delete `accuracy-data-test`.
- The first scheduled run then creates `accuracy-data` the same way. Check its Vercel deployment list once more.
