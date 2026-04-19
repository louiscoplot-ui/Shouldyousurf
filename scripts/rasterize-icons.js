const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");

(async () => {
  // Variant proposals (kept for comparison)
  const variants = ["icon-v1", "icon-v2", "icon-v3", "icon-v4"];
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

  // Main icon — sourced from icon.svg (or icon-source.png if it exists)
  const sourcePng = path.join(pubDir, "icon-source.png");
  const iconSvg = path.join(pubDir, "icon.svg");
  const source = fs.existsSync(sourcePng) ? fs.readFileSync(sourcePng) : fs.readFileSync(iconSvg);

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
    await sharp(source).resize(size, size).png().toFile(out);
    console.log("wrote", out);
  }
})();
