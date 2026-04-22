// Generate apple-touch-startup-image PNGs for common iPhone sizes.
// Each splash matches our bootsplash look: light blue gradient, the Fraunces
// brand wordmark, and the mono "READING THE OCEAN..." tagline underneath.
// Run with: node scripts/generate-splash.js

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "splash");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// iPhone splash sizes (portrait only — iOS uses landscape = rotated portrait).
// w × h, label used for filename + link media query.
const SIZES = [
  { w: 1290, h: 2796, dw: 430, dh: 932 },   // iPhone 15 Pro Max / 14 Pro Max
  { w: 1179, h: 2556, dw: 393, dh: 852 },   // iPhone 15 Pro / 14 Pro / 15 / 14
  { w: 1170, h: 2532, dw: 390, dh: 844 },   // iPhone 13 / 12
  { w: 1125, h: 2436, dw: 375, dh: 812 },   // iPhone 11 Pro / X / XS
  { w: 1284, h: 2778, dw: 428, dh: 926 },   // iPhone 12/13 Pro Max / 11 Pro Max
  { w: 1242, h: 2688, dw: 414, dh: 896 },   // iPhone XS Max
  { w: 828,  h: 1792, dw: 414, dh: 896 },   // iPhone XR / 11
  { w: 1242, h: 2208, dw: 414, dh: 736 },   // iPhone 6/7/8 Plus
  { w: 750,  h: 1334, dw: 375, dh: 667 },   // iPhone 6/7/8 / SE 2/3
  { w: 640,  h: 1136, dw: 320, dh: 568 },   // iPhone SE (1st gen) / 5
];

const mkSvg = (w, h) => {
  // Scale fonts so the splash looks right across resolutions.
  // Using min dimension so landscape-ish wouldn't crush type.
  const base = Math.min(w, h);
  const brandFs = Math.round(base * 0.11);
  const tagFs   = Math.round(base * 0.022);
  const dotR    = Math.round(base * 0.012);
  const dotGap  = Math.round(base * 0.018);
  const brandY  = Math.round(h * 0.48);
  const dotsY   = Math.round(h * 0.55);
  const tagY    = Math.round(h * 0.60);

  const dotCX1 = w/2 - (dotGap + dotR * 2);
  const dotCX2 = w/2;
  const dotCX3 = w/2 + (dotGap + dotR * 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#eef4f8"/>
        <stop offset="100%" stop-color="#dde7ee"/>
      </linearGradient>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0c2a5e"/>
        <stop offset="100%" stop-color="#1558b5"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>
    <text x="${w/2}" y="${brandY}" text-anchor="middle" dominant-baseline="middle"
          font-family="Georgia, 'Times New Roman', serif" font-weight="500"
          font-size="${brandFs}" fill="url(#brand)"
          letter-spacing="-0.03em">Should You Surf?</text>
    <circle cx="${dotCX1}" cy="${dotsY}" r="${dotR}" fill="#f59e0b"/>
    <circle cx="${dotCX2}" cy="${dotsY}" r="${dotR}" fill="#1558b5"/>
    <circle cx="${dotCX3}" cy="${dotsY}" r="${dotR}" fill="#f59e0b"/>
    <text x="${w/2}" y="${tagY}" text-anchor="middle" dominant-baseline="middle"
          font-family="Helvetica, Arial, sans-serif" font-weight="500"
          font-size="${tagFs}" fill="#f59e0b"
          letter-spacing="${Math.round(tagFs * 0.2)}">READING THE OCEAN</text>
  </svg>`;
};

(async () => {
  for (const s of SIZES) {
    const svg = mkSvg(s.w, s.h);
    const file = path.join(OUT, `iphone-${s.w}x${s.h}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    console.log("✓", path.relative(process.cwd(), file));
  }
  console.log("\nPaste these <link> tags into app/layout.js <head>:\n");
  for (const s of SIZES) {
    console.log(
      `<link rel="apple-touch-startup-image" media="(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: ${Math.round(s.w/s.dw)}) and (orientation: portrait)" href="/splash/iphone-${s.w}x${s.h}.png" />`
    );
  }
})();
