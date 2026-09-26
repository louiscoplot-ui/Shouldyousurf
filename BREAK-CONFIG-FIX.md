# Break config fix: Australian breaks (branch `fix/break-config`)

Source findings: `accuracy/break-audit.md` and `accuracy/BREAK-TYPES.md` on branch `feature/accuracy-audit`.

Scope: **`app/breaks.js` data only.** The scoring engine (`app/v2/lib/`) is not modified.

| Part | Status |
|---|---|
| 1. Types for 8 reef breaks | **Applied** (commit `1ef7185`) |
| 2. Coordinates for Burleigh, Yallingup, Waitpinga | **Applied** (commit `937814b`) |
| 2. Coordinates for Gnaraloo | **Waiting** for the reef position from the maintainer (separate commit) |
| 3. Marine overrides for Kirra, Burleigh, Yallingup | **Applied** (commit `b29fe45`), with a test adjustment explained there |
| 3. Marine override for Gnaraloo | **Waiting**: recomputed from Gnaraloo's confirmed coordinates |
| Trigg golden test | **Added before any edit** (commit `7b8f56e`); byte-identical after every commit |
| `CACHE_V` | **Not bumped** (maintainer decision) |

---|---|
| 1. Types for 8 reef breaks | **Applied** (commit `1ef7185`) |
| 2. Coordinates for 4 breaks | **Proposed, waiting for your OK** |
| 3. Marine sample points (Kirra, Burleigh, Gnaraloo, plus Yallingup) | **Proposed, waiting for your OK** |
| Trigg golden test | **Added before any edit** (commit `7b8f56e`) and passing |

---

## 1. Types (applied)

| Break | Before | After |
|---|---|---|
| Margaret River Main | — | `type: "reef", heavy: true` |
| Gnaraloo (Tombstones) | — | `type: "reef", heavy: true` |
| Yallingup | — | `type: "reef"` |
| Bells Beach | — | `type: "reef"` |
| Winkipop | — | `type: "reef"` |
| Angourie | — | `type: "reef"` |
| Lennox Head | — | `type: "reef"` |
| Alexandra Headland | — | `type: "reef"` (safe side) |
| Shipstern Bluff | `type: "reef", heavy: true` | unchanged (already correct, line 78) |

Effect, measured with the app's own functions on the same small clean hour (0.5 m / 10 s, 5 km/h offshore):

| Break | Level | Before | After |
|---|---|---|---|
| Bells, Lennox | first_timer | WORTH IT 26 | **SKIP 21** |
| Bells, Lennox | beginner | **GO 77 (Excellent)** | **SKIP 26** + reef tip + danger banner |
| Bells, Lennox | early_int | WORTH IT 24 | WORTH IT 24 (unchanged verdict; loses the whitewash fallback on bigger days) |
| Bells, Lennox | intermediate | WORTH IT 11 | WORTH IT 11 (plus a reef session note) |

Advanced and expert see no change. The raw score (`scoreV2`) never reads the type.

**Audit before/after (types).** Each of the 8 breaks loses its "no `type`" review item. "Needs review" goes from 20 to 14. Trigg's audit entry is byte-identical.

## 2. Coordinates (applied for Burleigh, Yallingup, Waitpinga; Gnaraloo pending)

**How these were found, honestly:**
- Google Maps, OpenStreetMap search, GeoNames, Geoscience Australia place names, Wikipedia and the surf-atlas sites are all **blocked from this session**.
- Each proposal is therefore the named beach **snapped to the real shoreline** of the OpenStreetMap coastline (10 m accuracy, available locally), guided by the web-search sources listed.
- **Please check each pin on the satellite view before I apply anything.**

| Break | Current (old) | Proposed (new) | Problem today | Source | Confidence |
|---|---|---|---|---|---|
| **Burleigh Heads** | `-28.1006, 153.4500` · [map](https://www.google.com/maps/search/?api=1&query=-28.1006,153.4500) | `-28.0908, 153.4573` · [map](https://www.google.com/maps/search/?api=1&query=-28.0908,153.4573) | Pin sits in or behind Tallebudgera Creek: no bearing has more than 1 km of open water | OSM coastline: headland tip at -28.0944, 153.4618; proposed pin on its **north shore**, where the point wave runs toward the beach. Web search: "approx 28.09° S 153.46° E" (surf-forecast.com summary) | medium: check that the pin is on the point, not on the beach further north |
| **Gnaraloo (Tombstones)** | `-23.8489, 113.5350` · [map](https://www.google.com/maps/search/?api=1&query=-23.8489,113.5350) | `-23.8463, 113.5142` · [map](https://www.google.com/maps/search/?api=1&query=-23.8463,113.5142) | Pin is 2.1 km **inland** | OSM coastline: nearest shore to the current pin. Web: Tombstones is "a 2 km drive south of the 3 Mile campsite" (Gnaraloo Station, via search summary), but I found no coordinates for the reef itself | **low**: this fixes "inland", but the reef may be a few km along the coast. Move the pin onto the reef on satellite if you know it |
| **Yallingup** | `-33.6406, 114.9908` · [map](https://www.google.com/maps/search/?api=1&query=-33.6406,114.9908) | `-33.6443, 115.0211` · [map](https://www.google.com/maps/search/?api=1&query=-33.6443,115.0211) | Pin is 2.6 km **out to sea** | Yallingup town (latlong.info, via search: -33.64592, 115.03514) snapped to the nearest OSM shore, i.e. Yallingup beach, where the reef is | medium-high |
| **Waitpinga** | `-35.6467, 138.5644` · [map](https://www.google.com/maps/search/?api=1&query=-35.6467,138.5644) | `-35.6363, 138.5010` · [map](https://www.google.com/maps/search/?api=1&query=-35.6363,138.5010) | Pin is 2.9 km **out to sea**, about 6 km east of the beach | Two web sources for Waitpinga Beach (-35.6344, 138.4989 from the search summary; -35.6361, 138.5041 from bonzle.com) both snap onto the same beach; proposed pin is their midpoint on the OSM shore | high |

## 3. Marine sample points (applied for Kirra, Burleigh, Yallingup; Gnaraloo pending)

### How the app picks the point today (`app/v2/lib/realFetch.js`)

1. `marineSamplePoint(spot, bearing)`: **if the break has `marineLat` and `marineLng`, those are used as they are.** This per-break override already exists, and a test covers it (`tests/scoring.test.mjs`, "marineLat/marineLng forcent le point").
2. Otherwise: 5 km from the break toward `bearing`, which is the offshore-bearing probe's result when this device has cached it, else `idealSwellDir`.
3. The probe runs in the background on the first load and is only used from the **second** load on, so every first load, and every new device, uses `idealSwellDir`.

At a point break like Kirra, `idealSwellDir` (SE, 135°) points along the coast or into the headland, so the 5 km point lands on land.

### Smallest data-only fix

Set `marineLat` / `marineLng` on the affected breaks. No engine change is needed. Each proposed point is 5 km from the break (the same distance the app uses everywhere), toward the break's measured open-ocean direction, and checked to be on water and several km from any shore:

| Break | Default point today | Proposed override | Check |
|---|---|---|---|
| **Kirra** | `-28.2014, 153.5693` **on land** (0.15 km inland) · [map](https://www.google.com/maps/search/?api=1&query=-28.2014,153.5693) | `marineLat: -28.1389, marineLng: 153.5709` · [map](https://www.google.com/maps/search/?api=1&query=-28.1389,153.5709) | sea, 3.3 km from shore |
| **Burleigh Heads** (with the new coordinates) | would be `-28.1228, 153.4933`, sea but **0.7 km** from shore | `marineLat: -28.0753, marineLng: 153.5051` · [map](https://www.google.com/maps/search/?api=1&query=-28.0753,153.5051) | sea, 4.8 km from shore |
| **Gnaraloo** (with the new coordinates) | would be `-23.8783, 113.4795`, sea but **0.7 km** from shore | `marineLat: -23.8290, marineLng: 113.4688` · [map](https://www.google.com/maps/search/?api=1&query=-23.8290,113.4688) | sea, 4.8 km from shore |
| **Yallingup** (with the new coordinates) | would be `-33.6763, 114.9829`, sea but **0.9 km** from shore | `marineLat: -33.6307, marineLng: 114.9696` · [map](https://www.google.com/maps/search/?api=1&query=-33.6307,114.9696) | sea, 4.7 km from shore |

**Why the last three matter even though their default points are on water:** the wave model's grid is several km wide. A point under 1 km from shore reads a coastal cell, which is the Trigg problem measured on 01/08: the coastal cell read 1.32 m where the first all-water cell read 1.64 m (−24%). Yallingup needs this **because** its coordinates are being fixed. Its old pin, 2.6 km out at sea, accidentally put the sample point well offshore.

Waitpinga needs no override: with the new coordinates its default point is 4 km offshore.

⚠️ **Not verifiable from here:** which Open-Meteo grid cell each point actually hits (the API is blocked in this session). The daily accuracy logger will show it: after deploy, the model rows for these breaks should stop looking like coastal cells.

### Audit preview with parts 2 and 3 applied (on a temporary copy, not committed)

| Break | Before | After |
|---|---|---|
| Burleigh Heads | coast 0.1 km, **no open-ocean window**, marine point **on land** | coast 0.01 km, window 10–130°, facing 70°, marine point at sea |
| Gnaraloo | **2.1 km inland**, marine point **on land**, ideal swell outside window | on the shore, window 220–5°, marine point at sea, **no review item** |
| Yallingup | **2.6 km offshore** | on the shore, window 225–350°, **no review item** |
| Waitpinga | **2.9 km offshore** | on the shore, window 120–230°, **no review item** |
| Kirra | marine point **on land** | marine point at sea |

"Needs review" would go from 14 to 11. The 11 left, none of them in this task's scope:
- **6 sand points left untyped by decision:** The Pass, Crescent Head, Snapper Rocks, Kirra, Burleigh Heads, Noosa. The audit flags any known point without a type; that's its heuristic, not an error.
- **4 whose `idealSwellDir` has no open ocean from the pin:** North Narrabeen, Duranbah, Middleton, Shipstern Bluff. That's a scoring-direction question, for a later decision.
- **Clifton Beach:** deeply sheltered in Storm Bay (no bearing with 100 km of open water).

---

## Before you merge: change, reason, risk, verification, rollback

**Change.** Part 1 (applied): 8 lines in `app/breaks.js`, one per break, adding `type` (and `heavy` on 2). Parts 2 and 3 (after your OK): up to 5 more lines in the same file (coordinates on 4, `marineLat/marineLng` on 4). Plus the permanent Trigg golden test (`tests/trigg-golden.test.mjs` + 3 fixture files) and this note.

**Reason.**
- Reef breaks without a type were advising learners like beach breaks: GO 77 for a beginner at Bells.
- Four pins were inland, at sea or in a creek, so the app read the wrong water.
- Three marine forecasts came from land or coastal cells.

**Risk.**
- *Intended behaviour change:* learners now see SKIP, the reef tip and the red danger banner **every day** at 8 more breaks. That's the alert-fatigue question in `BREAK-TYPES.md` §4.
- *Forecast numbers will shift* at the 5 relocated or overridden breaks (parts 2 and 3). That's the point of the fix, but users of those breaks will see different heights.
- *Cache:* the app seeds from the last cached forecast, whose `effectiveSpot` carries the old config, for about a second until the fresh fetch replaces it (or up to 24 h offline). `CACHE_V` was deliberately **not** bumped, since it lives in the engine file and this task is data-only. Say if you want it bumped anyway.
- *Trigg and the other 21 AU breaks:* no change. This is proven for Trigg, and nothing else in their entries changed.

**How to verify.**
1. `npm test`: **160/160** pass, including the 2 Trigg golden tests.
2. The Trigg proof: its output regenerated **after** the edit has the same sha256 as the snapshot recorded **before** it (`9c63e36e…62396`), in 5 device timezones.
3. `npm run lint:undef`: 0 errors.
4. On the Vercel preview of `fix/break-config`: open Bells as a beginner (expect SKIP + reef tip), open Trigg (expect exactly what prod shows).
5. After parts 2 and 3: open the four relocated breaks and check the pin location in the break list.

**Rollback.**
- `git revert <commit>` on `main` for the relevant commit. Each part is a separate commit, so types, coordinates and marine points can be reverted independently.
- One revert = one production deploy.
- The data is plain, so nothing else needs to be undone. The Trigg golden test stays valid either way, because Trigg was never touched.
