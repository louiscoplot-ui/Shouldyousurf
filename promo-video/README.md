# Should You Surf? — 15s promo video

A 15-second 1080×1920, 30 fps vertical video for Reels/TikTok, built with
[Remotion](https://www.remotion.dev).

**This folder stands on its own.** It has its own `package.json` and
`node_modules`. The Next.js app, `vercel.json` and CI never import anything
from here, and Vercel only installs the root `package.json`, so nothing in
this folder changes the site.

The one link runs the other way: `src/data.js` **imports** the app's real
scoring engine (`app/v2/lib/prodScoring.js` and `verdict.js`). Every score,
verdict and reason on screen is computed at render time by the same code
that runs on shouldyousurf.com.

## Render

```bash
cd promo-video
npm install
npm run render      # -> out/shouldyousurf-promo.mp4 (~45 s)
npm run stills      # -> out/still-1-hook.png, still-2-verdicts.png, still-3-endcard.png
npm run studio      # live preview + timeline in the browser
```

On first run Remotion downloads its own headless Chrome. If that download is
blocked, point it at a Chrome you already have:

```bash
REMOTION_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run render
```

## Changing things

| I want to change... | Edit |
|---|---|
| Words on screen (hook, "Same wave.", URL, "Trigg + 90 breaks worldwide", ...) | `COPY` in `src/data.js` |
| The surf conditions (swell, period, wind by hour, tide) | `src/scenario.js`. The score, verdicts, reasons, best window and face height all recompute from it. |
| Which level gets the big score / which hour | `HERO_LEVEL` and `HERO_HOUR` in `src/data.js` |
| Scene length or order | `SCENES` in `src/Promo.jsx` (30 frames = 1 s, 450 total) |
| Colours / fonts | `src/theme.js` (copied from `app/v2/v2.css`) |
| Music | Put the file in `public/` (e.g. `public/music.mp3`) and set `MUSIC_FILE = "music.mp3"` in `src/Promo.jsx` |

If you change the scenario, the numbers change on their own. **Don't type a
number into a scene.** Every scene reads its values from `src/data.js`.

## Reference screenshots of the real app

`reference/*.png` are screenshots of the real app, taken locally at
iPhone 14 size (390×844 @3x). Open-Meteo is intercepted and answered with
`src/scenario.js`, so the app shows exactly the Trigg morning the video
animates. The hero shot is also copied to `public/app-screenshot.png` for the
phone mockup. Nothing is deployed.

```bash
# terminal 1, repo root
npm ci && npx next dev -p 3100
# terminal 2
cd promo-video && npm run screenshots   # CHROME_PATH=... if Playwright's browser isn't installed
```

## Files

```
promo-video/
├── package.json          own deps (remotion, @remotion/cli, react; playwright for screenshots)
├── remotion.config.js    render settings: h264, yuv420p, bt709, CRF 18
├── src/
│   ├── index.js          Remotion entry point
│   ├── Root.jsx          compositions: "Promo" (the video), "LogoCompare" (logo review)
│   ├── Promo.jsx         15 s timeline + the audio slot
│   ├── scenario.js       Trigg morning inputs (shared by the video and the screenshots)
│   ├── data.js           runs the real scoring engine and holds all on-screen text (COPY)
│   ├── theme.js          brand colours / fonts
│   ├── fonts.js          loads the bundled woff2 files before the first frame
│   ├── Waves.jsx         animated layered swell lines
│   ├── Logo.jsx          SVG redraw of icon-512.png, animatable part by part
│   ├── LogoCompare.jsx   original icon next to the redraw, for review
│   └── scenes/           Hook, Score, SameWave, Timeline, AppPhone, WavePayoff, EndCard
├── scripts/
│   ├── stills.mjs        renders the 3 review frames
│   └── screenshots.mjs   Playwright screenshots of the local app, with Open-Meteo mocked
├── public/               icon-512.png, app-screenshot.png, fonts/ (Bricolage Grotesque, Geist, Geist Mono, OFL)
└── reference/            real-app screenshots used as the visual reference
```

## Licence note

Remotion is free for individuals and companies with up to 3 employees.
Larger companies need a company licence (remotion.pro).
