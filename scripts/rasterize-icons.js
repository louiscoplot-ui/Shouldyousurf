const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");

(async () => {
  // Variant comparison PNGs
  const variants = ["icon-v1", "icon-v2", "icon-v3"];
  for (const v of variants) {
    const svg = fs.readFileSync(path.join(pubDir, v + ".svg"));
    for (const size of [192, 512]) {
      const out = path.join(pubDir, `${v}-${size}.png`);
      await sharp(svg).resize(size, size).png().toFile(out);
      console.log("wrote", out);
    }
  }

  // Chosen variant → main icons for PWA + apple-touch
  const chosenSvg = fs.readFileSync(path.join(pubDir, "icon-v3.svg"));
  for (const [size, name] of [[180, "icon-180.png"], [192, "icon-192.png"], [512, "icon-512.png"], [512, "icon.png"]]) {
    const out = path.join(pubDir, name);
    await sharp(chosenSvg).resize(size, size).png().toFile(out);
    console.log("wrote", out);
  }
})();
