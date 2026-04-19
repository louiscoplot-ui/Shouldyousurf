const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");

(async () => {
  // Variant proposals (kept for comparison)
  const variants = ["icon-v1", "icon-v2", "icon-v3", "icon-v4", "icon-v5"];
  for (const v of variants) {
    const svgPath = path.join(pubDir, v + ".svg");
    if (!fs.existsSync(svgPath)) continue;
    const svg = fs.readFileSync(svgPath);
    for (const size of [192, 512]) {
      const out = path.join(pubDir, `${v}-${size}.png`);
      await sharp(svg).resize(size, size).png().toFile(out);
      console.log("wrote", out);
    }
  }

  // Main icon pipeline: crop the centered rounded-square from the ChatGPT-
  // generated source (which has dark radial padding around the actual icon),
  // then resize to every size we need.
  const sourcePath = path.join(pubDir, "icon-source.png");
  if (!fs.existsSync(sourcePath)) {
    console.log("no icon-source.png — skipping main icon generation");
    return;
  }

  const meta = await sharp(sourcePath).metadata();
  const cropSize = Math.round(Math.min(meta.width, meta.height) * 0.566);
  const left = Math.round((meta.width - cropSize) / 2);
  const top  = Math.round((meta.height - cropSize) / 2);
  const cropped = await sharp(sourcePath)
    .extract({ left, top, width: cropSize, height: cropSize })
    .toBuffer();

  const outputs = [
    [512, "icon.png"],
    [512, "icon-512.png"],
    [192, "icon-192.png"],
    [180, "apple-touch-icon.png"],
    [32,  "favicon-32.png"],
    [16,  "favicon-16.png"],
  ];
  for (const [size, name] of outputs) {
    const out = path.join(pubDir, name);
    await sharp(cropped).resize(size, size).png().toFile(out);
    console.log("wrote", out);
  }
})();
