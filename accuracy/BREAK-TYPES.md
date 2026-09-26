# Break types: what the engine does with them, and a proposal for the 14 untyped breaks

> **Decision (26/09/2026):** proposal approved, with **Alexandra Headland = reef** (err on the safe side). Shipstern Bluff is already `type: "reef", heavy: true` (`app/breaks.js:78`). The `breaks.js` edits belong to a separate config-fix task, together with the wrong coordinates and the marine sample points on land from `break-audit.md`.

**Report only. `app/breaks.js` is not edited.** Line numbers refer to `main` at the time of writing.

## 1. What the engine supports

There are two fields, and only **one value** of `type` is ever tested.

| Field | Values the code tests | Anything else |
|---|---|---|
| `type` | `"reef"` only (`spot.type === "reef"` / `!== "reef"`) | Missing, `"beach"`, `"point"` or any other string = **beach-break behaviour** |
| `heavy` | `true` | Missing/false = not heavy |

**`type: "reef"` and `heavy: true` do exactly the same thing in the logic.** Every check is written `spot.heavy || spot.type === "reef"` (or the negation of it). The only difference is the label shown in the break list: `heavy` adds "· heavy".

**Neither field changes the raw surf score.** `scoreV2` never reads them. They act through the **personal verdict** and the **advice**. The verdict then caps the displayed score through the band ceilings (SKIP ≤ 29), so for learners the number shown does drop.

**"point" is not a type the engine knows.** A sand point and a beach break behave identically. Setting `type: "point"` today would only change the label, and it would show the raw word "point" untranslated in all 12 languages: `getT` falls back to the key itself (`app/i18n.js:2990`).

## 2. Exactly what "reef" (or "heavy") changes, level by level

| Level | Effect | Where |
|---|---|---|
| **first_timer, beginner** | `reefTooMuch = true` on **every** hour, whatever the conditions | `prodScoring.js:797` |
| | Verdict is **SKIP, always**, even on a flat, glassy, tiny day | `getPersonalVerdict`, `prodScoring.js:1092` |
| | Score capped to the SKIP band (≤ 29, "Poor"/"Skip") | `scoreForLevel` band ceiling |
| | Tip: "This is a reef break, not a place to learn…" (`tip_<level>_reef`), unless a rip warning takes priority | `getPersonalAdviceKey`, `prodScoring.js:863` |
| | No secondary advice line (the modifier is suppressed) | `getPersonalModifier`, `prodScoring.js:898` |
| | **Red "Dangerous conditions" banner, every hour of every day** (it fires on `reefTooMuch`) | `MainScreen.jsx:627` |
| | Level-table row reason: "Reef / heavy spot — too risky" | `verdict.js:182` |
| | **No whitewash fallback**: `hasInsideReform` is false, so there's no "foamie inside" rescue and no "stay INSIDE on the foamie" note | `prodScoring.js:840`, `:996` |
| | Board advice loses the foamie-inside options: first_timer above 2 ft → "Watch today"; beginner above 3 ft → "Wait smaller" | `getBoardRec`, `isFoamieFriendly`, `:818` |
| **early_int** | **No whitewash fallback.** When the peak is too big or blown out they take the normal path (MAYBE/SKIP) instead of "Bail the peak, take the inside reform" | `hasInsideReform`, `:840` |
| | Session note: "Reef / heavy spot — know the entry, watch the locals, don't drop in" | `getSessionNotes`, `:989` |
| | Verdict is **not** forced to SKIP | |
| **intermediate** | Session note only (same text) | `:989` |
| **advanced, expert** | **Nothing** | |

What a *beach break* (the default) gets instead: for first_timer, beginner and early_int, when the peak is too big, messy or blown out (up to 6 / 8 / 10 ft face), the verdict can come back as "worth it, stay inside on the reform". That rescue is exactly what "reef" removes.

## 3. Proposal for the 14 untyped breaks

⚠️ **The bottom types below come from general surf knowledge, not from data or a survey.** Kirra and Snapper are sand-bottom points, as you said, and stay untyped. Please confirm or correct each row before anyone edits `breaks.js`.

| Break | Bottom (surf knowledge) | Proposed | Confidence | What changes for learners |
|---|---|---|---|---|
| Margaret River Main | reef, powerful | `type: "reef", heavy: true` | high | SKIP + reef tip + danger banner, every day |
| Yallingup | reef | `type: "reef"` | high | same |
| Gnaraloo (Tombstones) | reef, heavy | `type: "reef", heavy: true` | high | same |
| Bells Beach | reef | `type: "reef"` | high | same |
| Winkipop | reef, fast | `type: "reef"` | high | same |
| Angourie | rocky reef point | `type: "reef"` | high | same |
| Lennox Head | boulder point | `type: "reef"` (a rock bottom is a reef as far as the engine is concerned) | medium | same |
| Alexandra Headland | rocky point, next to a learner-friendly beach | **your call:** `"reef"` if the pin is the point, nothing if it's the beach | low | |
| Snapper Rocks | sand-bottom point | **none** | high (your correction) | unchanged |
| Kirra | sand-bottom point | **none** | high (your correction) | unchanged |
| Burleigh Heads | sand point, rocks at the headland | none | medium | unchanged |
| Noosa (First Point) | sand point, mellow | none | high | unchanged |
| The Pass (Byron) | sand point, mellow | none | high | unchanged |
| Crescent Head | sand/rock point, mellow | none | medium | unchanged |

**Proposed:** 7 reefs, 1 undecided, 6 stay untyped.

## 4. Things to decide before typing anything

1. **The danger banner will be permanent at every reef for learners.** A beginner who opens Bells sees a red "Dangerous conditions" banner on a 1 ft glassy day. That's consistent with "not a place to learn", but it's the same alert-fatigue problem CLAUDE.md warns about for wind (the 17/09 case). Options: accept it, or later give reef its own calmer message. Either way that's an engine change, out of scope here.
2. **Sand points get the beach "whitewash fallback".** At Snapper, Kirra or Burleigh the "inside" can be a sweep along rocks, not a gentle reform. The engine has no way to say "point, but not a reef". Adding a `"point"` type would need scoring changes, tests and translations, so it's also out of scope. I'm raising it so it isn't forgotten.
3. **`heavy` adds nothing but the label.** Use it only where the label matters to you (Margaret River, Gnaraloo). Otherwise `type: "reef"` alone is enough.
4. **Scoring rule (CLAUDE.md):** typing breaks changes verdicts, so when you do it, bump `CACHE_V` and run `npm test` in the same change.
