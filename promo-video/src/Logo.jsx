// Vector redraw of public/icon-512.png (the app icon): a ring, a wave rising
// from the lower left whose lip curls into a "?", and the question-mark dot.
// Drawn on a 512 grid so it lines up 1:1 with the original PNG.
//
// Every part takes a 0..1 progress so the end card can build it piece by
// piece: ring strokes on, wave rises, dot drops in last.
// All at 1 (the default) = the static logo.
import React from "react";

export const RING = { cx: 256, cy: 241, r: 191, width: 14 };
const RING_LEN = 2 * Math.PI * RING.r;

// One filled outline: the back of the wave, the lip curling over into the
// "?" (outer edge, neck, inner edge), then the barrel and the white water
// below it. Coordinates traced from icon-512.png.
export const WAVE_PATH = [
  "M30,292",
  "C128,244 196,160 298,146", // back of the wave up to the crest
  "C348,138 380,168 378,206", // outer top-right of the "?"
  "C375,242 348,258 331,274", // outer right side, coming down
  "C320,284 317,291 317,299", // neck, right edge
  "L295,299",                 // bottom of the neck
  "C295,283 303,266 324,248", // neck, left edge going up
  "C344,231 350,218 347,204", // inside of the "?"
  "C342,186 322,180 302,186", // underside of the lip = top of the barrel
  "C262,200 236,236 238,276", // left wall of the barrel
  "C240,326 284,360 330,358", // barrel floor
  "C372,356 408,344 444,320", // white water back out to the right
  "L500,290 L500,520 L30,520 Z",
].join(" ");

export const DOT = { cx: 305, cy: 326, r: 15 };

export function Logo({
  size = 512, ring = 1, wave = 1, dot = 1, dotDrop = 0,
  color = "#ffffff", background = null, radius = 0,
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id="sys-logo-clip">
          <circle cx={RING.cx} cy={RING.cy} r={RING.r - 5} />
        </clipPath>
        <linearGradient id="sys-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15305f" />
          <stop offset="1" stopColor="#081733" />
        </linearGradient>
      </defs>
      {background && <rect width="512" height="512" rx={radius} fill={background === "icon" ? "url(#sys-logo-bg)" : background} />}
      <circle
        cx={RING.cx} cy={RING.cy} r={RING.r} fill="none" stroke={color} strokeWidth={RING.width}
        strokeDasharray={RING_LEN} strokeDashoffset={RING_LEN * (1 - ring)}
        transform={`rotate(-90 ${RING.cx} ${RING.cy})`} strokeLinecap="round"
      />
      <g clipPath="url(#sys-logo-clip)">
        <path d={WAVE_PATH} fill={color} transform={`translate(0 ${(1 - wave) * 300})`} />
      </g>
      <circle cx={DOT.cx} cy={DOT.cy - dotDrop} r={DOT.r * dot} fill={color} />
    </svg>
  );
}
