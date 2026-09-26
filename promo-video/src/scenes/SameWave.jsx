// 5-8s — the hero moment: same wave, beginner SKIP vs intermediate GO.
// Verdicts and reasons come from levelMatrixFor, like LevelMatrix.jsx.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, displayStyle, monoLabel } from "../theme.js";
import { BEGINNER, COPY, HERO, INTERMEDIATE, VERDICT_UI } from "../data.js";
import { getLevel } from "../../../app/v2/lib/verdict.js";
import { Waves } from "../Waves.jsx";

const Card = ({ row, from, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: frame - delay, fps, config: { damping: 15 } });
  const stamp = spring({ frame: frame - delay - 10, fps, config: { damping: 9, mass: 0.6 } });
  const v = VERDICT_UI[row.verdict];
  const band = getLevel(row.score);
  return (
    <div
      style={{
        width: 450, height: 640, borderRadius: 44, background: C.paperHi, border: `3px solid ${C.border}`,
        boxShadow: "0 30px 60px rgba(26,61,58,0.14)", padding: "48px 38px", boxSizing: "border-box",
        display: "flex", flexDirection: "column", gap: 34,
        transform: `translateX(${(1 - slide) * from}px)`, opacity: slide,
      }}
    >
      <div style={{ ...displayStyle, fontSize: 64, color: C.ink }}>{row.name}</div>
      <div
        style={{
          alignSelf: "flex-start", fontFamily: F.mono, fontWeight: 600, fontSize: 84, letterSpacing: "0.06em",
          color: v.color, background: `${v.color}1f`, border: `4px solid ${v.color}`, borderRadius: 22,
          padding: "10px 30px", transform: `scale(${0.4 + 0.6 * stamp}) rotate(${(1 - stamp) * -8}deg)`, opacity: stamp,
        }}
      >
        {v.label}
      </div>
      <div style={{ fontFamily: F.body, fontSize: 42, lineHeight: 1.22, color: C.ink, fontWeight: 500 }}>{row.reason}</div>
      <div style={{ marginTop: "auto", ...monoLabel, fontSize: 28, color: band.color }}>
        {row.score} · {band.label}
      </div>
    </div>
  );
};

export const SameWave = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame, fps, config: { damping: 14 } });
  const answer = spring({ frame: frame - 34, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Waves
        layers={[
          { y: 1600, amp: 14, length: 700, speed: 0.08, color: C.jade, opacity: 0.18 },
          { y: 1660, amp: 18, length: 820, speed: 0.1, color: C.jade, opacity: 0.28 },
        ]}
      />
      <div style={{ position: "absolute", top: 250, width: "100%", textAlign: "center", opacity: title, transform: `translateY(${(1 - title) * 40}px)` }}>
        <div style={{ ...displayStyle, fontSize: 124, color: C.ink }}>{COPY.sameWave}</div>
        <div style={{ ...monoLabel, fontSize: 32, color: C.jade, marginTop: 22 }}>
          {HERO.faceLow}–{HERO.faceHigh} ft · {HERO.swell}
        </div>
      </div>
      <div style={{ position: "absolute", top: 520, left: 60, right: 60, display: "flex", justifyContent: "space-between" }}>
        <Card row={BEGINNER} from={-600} delay={6} />
        <Card row={INTERMEDIATE} from={600} delay={14} />
      </div>
      <div
        style={{
          position: "absolute", top: 1240, width: "100%", textAlign: "center", ...displayStyle, fontSize: 116, color: C.jade,
          opacity: answer, transform: `translateY(${(1 - answer) * 40}px)`,
        }}
      >
        {COPY.differentAnswer}
      </div>
      <div style={{ position: "absolute", inset: 0, background: C.paper, opacity: interpolate(frame, [0, 3], [1, 0], { extrapolateRight: "clamp" }) }} />
    </AbsoluteFill>
  );
};
