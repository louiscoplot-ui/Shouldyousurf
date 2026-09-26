// 11-13s — the ocean rises over the phone and wipes to the end card.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, displayStyle } from "../theme.js";
import { Waves } from "../Waves.jsx";
import { COPY } from "../data.js";

export const WavePayoff = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = (delay, to) => (f) =>
    interpolate(f, [delay, delay + 26], [2000, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const t = spring({ frame: frame - 24, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Waves
        layers={[
          { y: rise(0, -80), amp: 60, length: 900, speed: 0.16, color: "#9ad5c1", opacity: 0.9 },
          { y: rise(4, -60), amp: 55, length: 780, speed: 0.2, color: C.jade },
          { y: rise(8, -40), amp: 50, length: 680, speed: 0.24, color: C.blue },
          { y: rise(12, -30), amp: 45, length: 600, speed: 0.28, color: C.navy },
        ]}
      />
      {/* once the screen is covered, the swell keeps rolling underneath the line */}
      <Waves
        style={{ opacity: interpolate(frame, [22, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
        layers={[
          { y: 1330, amp: 18, length: 620, speed: 0.12, color: C.blue, opacity: 0.35 },
          { y: 1420, amp: 24, length: 760, speed: 0.15, color: C.jade, opacity: 0.35 },
          { y: 1530, amp: 30, length: 900, speed: 0.18, color: C.navyDeep, opacity: 0.8 },
        ]}
      />
      <div
        style={{
          position: "absolute", top: 760, width: "100%", textAlign: "center", ...displayStyle, fontSize: 150,
          color: C.cream, opacity: t, transform: `translateY(${(1 - t) * 80}px)`,
        }}
      >
        {COPY.wavePayoff.map((l, i) => (
          <div key={i} style={{ color: i === 1 ? "#9ad5c1" : C.cream }}>{l}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
