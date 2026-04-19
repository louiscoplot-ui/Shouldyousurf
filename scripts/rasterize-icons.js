const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");

(async () => {
  const variants = ["icon-v1", "icon-v2", "icon-v3"];
  for (const v of variants) {
    const svg = fs.readFileSync(path.join(pubDir, v + ".svg"));
    for (const size of [192, 512]) {
      const out = path.join(pubDir, `${v}-${size}.png`);
      await sharp(svg).resize(size, size).png().toFile(out);
      console.log("wrote", out);
    }
  }
})();
