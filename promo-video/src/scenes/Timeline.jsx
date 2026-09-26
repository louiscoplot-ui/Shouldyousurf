// 8-10s — hour by hour, the best window lights up.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, displayStyle, monoLabel } from "../theme.js";
import { BEST, COPY, TIMELINE, fmt } from "../data.js";

const BAR_W = 86;
const GAP = 16;
const MAX_H = 720;
const BASE_Y = 1380;

export const Timeline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const totalW = TIMELINE.length * BAR_W + (TIMELINE.length - 1) * GAP;
  const left = (1080 - totalW) / 2;
  const hl = spring({ frame: frame - 26, fps, config: { damping: 14 } });
  const bx = left + BEST.from * (BAR_W + GAP) - 14;
  const bw = (BEST.to - BEST.from + 1) * (BAR_W + GAP) - GAP + 28;
  const bestH = Math.max(...TIMELINE.map((t) => t.score)) / 100 * MAX_H;

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{ position: "absolute", top: 250, left: 80, right: 80 }}>
        <div style={{ ...monoLabel, fontSize: 30, color: C.jade }}>Intermediate · Trigg</div>
        <div style={{ ...displayStyle, fontSize: 110, color: C.ink, marginTop: 18 }}>{COPY.timelineTitle}</div>
      </div>
      {/* best-window highlight */}
      <div
        style={{
          position: "absolute", left: bx, top: BASE_Y - bestH - 84, width: bw, height: bestH + 154,
          borderRadius: 30, background: "rgba(45,145,120,0.12)", border: `4px solid ${C.jade}`,
          opacity: hl, transform: `scale(${0.92 + 0.08 * hl})`,
        }}
      />
      <div
        style={{
          position: "absolute", left: bx, top: BASE_Y - bestH - 190, fontFamily: F.mono, fontWeight: 600, fontSize: 38,
          color: C.paperHi, background: C.jade, borderRadius: 999, padding: "14px 28px", letterSpacing: "0.04em",
          opacity: hl, transform: `translateY(${(1 - hl) * 30}px)`, whiteSpace: "nowrap",
        }}
      >
        BEST WINDOW {BEST.label}
      </div>
      {TIMELINE.map((t, i) => {
        const g = spring({ frame: frame - i * 2, fps, config: { damping: 15 } });
        const h = (t.score / 100) * MAX_H * g;
        const inBest = i >= BEST.from && i <= BEST.to;
        const dim = inBest ? 1 : interpolate(hl, [0, 1], [1, 0.45]);
        const x = left + i * (BAR_W + GAP);
        return (
          <React.Fragment key={t.hour}>
            <div style={{ position: "absolute", left: x, top: BASE_Y - h, width: BAR_W, height: h, borderRadius: 16, background: t.color, opacity: dim }} />
            <div style={{ position: "absolute", left: x, width: BAR_W, top: BASE_Y - h - 56, textAlign: "center", ...displayStyle, fontSize: 44, color: t.color, opacity: g * dim }}>
              {t.score}
            </div>
            <div style={{ position: "absolute", left: x - 10, width: BAR_W + 20, top: BASE_Y + 24, textAlign: "center", fontFamily: F.mono, fontSize: 28, color: C.ink, opacity: dim }}>
              {fmt(t.hour)}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
