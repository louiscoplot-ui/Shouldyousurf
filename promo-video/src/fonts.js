// Fonts are bundled in public/fonts (latin subsets from Google Fonts, all
// OFL-licensed) so a render never depends on the network.
import { continueRender, delayRender, staticFile } from "remotion";

const FACES = [
  { family: "Bricolage Grotesque", file: "fonts/BricolageGrotesque-latin.woff2", weight: "500 800" },
  { family: "Geist", file: "fonts/Geist-latin.woff2", weight: "400 700" },
  { family: "Geist Mono", file: "fonts/GeistMono-latin.woff2", weight: "400 600" },
];

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("Loading brand fonts");
  Promise.all(
    FACES.map((f) =>
      new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font loading failed", err);
      continueRender(handle);
    });
}
