// 3-5s — the score counts up, exactly as the app's hero shows it.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, displayStyle, monoLabel } from "../theme.js";
import { COPY, HERO } from "../data.js";
import { SPOT } from "../scenario.js";

const R = 330;
const LEN = 2 * Math.PI * R;

export const Score = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [4, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const value = Math.round(HERO.score * p);
  const pop = spring({ frame: frame - 34, fps, config: { damping: 11, mass: 0.7 } });
  const enter = spring({ frame, fps, config: { damping: 16 } });
  const chips = [`${HERO.faceLow}–${HERO.faceHigh} ft`, HERO.swell, HERO.wind];

  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: "center" }}>
      <div style={{ position: "absolute", top: 250, ...monoLabel, color: C.ink, fontSize: 32 }}>
        {SPOT.name} · {COPY.scoreKicker}
      </div>
      <div style={{ position: "absolute", top: 340, width: 2 * R + 60, height: 2 * R + 60, transform: `scale(${0.85 + 0.15 * enter})` }}>
        <svg width={2 * R + 60} height={2 * R + 60} style={{ position: "absolute" }}>
          <circle cx={R + 30} cy={R + 30} r={R} fill={C.paperHi} stroke={C.border} strokeWidth={26} />
          <circle
            cx={R + 30} cy={R + 30} r={R} fill="none" stroke={HERO.band.color} strokeWidth={26} strokeLinecap="round"
            strokeDasharray={LEN} strokeDashoffset={LEN * (1 - (HERO.score / 100) * p)}
            transform={`rotate(-90 ${R + 30} ${R + 30})`}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ ...displayStyle, fontSize: 330, color: HERO.band.color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
          <span style={{ fontFamily: F.body, fontSize: 64, color: C.inkSoft, alignSelf: "flex-end", marginBottom: 250, marginLeft: 8 }}>/100</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute", top: 1100, ...displayStyle, fontSize: 170, color: HERO.band.color,
          opacity: pop, transform: `scale(${0.6 + 0.4 * pop})`,
        }}
      >
        {HERO.band.label}
      </div>
      <div style={{ position: "absolute", top: 1330, display: "flex", gap: 18, opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {chips.map((c) => (
          <div key={c} style={{ fontFamily: F.mono, fontSize: 34, color: C.ink, background: C.sand, border: `2px solid ${C.border}`, borderRadius: 999, padding: "14px 26px" }}>
            {c}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
