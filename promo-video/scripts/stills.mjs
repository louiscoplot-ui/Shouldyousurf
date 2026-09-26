// Renders 3 review frames to out/ (hook, verdicts, end card).
// Same browser override as the video: REMOTION_BROWSER=/path/to/chrome
import { execFileSync } from "node:child_process";

const STILLS = [
  ["still-1-hook.png", 80],
  ["still-2-verdicts.png", 225],
  ["still-3-endcard.png", 449],
];
for (const [file, frame] of STILLS) {
  execFileSync("npx", ["remotion", "still", "Promo", `out/${file}`, `--frame=${frame}`, "--log=error"], { stdio: "inherit" });
  console.log(`out/${file} (frame ${frame})`);
}
