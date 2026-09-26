// 13-15s — logo builds itself, then the URL.
import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, displayStyle } from "../theme.js";
import { Logo } from "../Logo.jsx";
import { Waves } from "../Waves.jsx";
import { COPY } from "../data.js";

export const EndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ring = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const wave = spring({ frame: frame - 10, fps, config: { damping: 13, mass: 0.7 } });
  const dotIn = spring({ frame: frame - 24, fps, config: { damping: 8, mass: 0.5 } });
  const fade = (from) => interpolate(frame, [from, from + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = (from) => ({ opacity: fade(from), transform: `translateY(${(1 - fade(from)) * 30}px)` });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navyDeep} 100%)`, alignItems: "center" }}>
      <Waves
        layers={[
          { y: 1520, amp: 18, length: 700, speed: 0.08, color: C.blue, opacity: 0.25 },
          { y: 1600, amp: 24, length: 860, speed: 0.1, color: C.navyDeep, opacity: 0.9 },
        ]}
      />
      <div style={{ position: "absolute", top: 330 }}>
        <Logo size={520} ring={ring} wave={wave} dot={Math.min(1, dotIn)} dotDrop={(1 - dotIn) * 160} />
      </div>
      <div style={{ position: "absolute", top: 930, ...displayStyle, fontSize: 112, color: C.cream, ...rise(30) }}>Should You Surf?</div>
      <div style={{ position: "absolute", top: 1100, fontFamily: F.mono, fontWeight: 600, fontSize: 70, color: C.amber, letterSpacing: "0.01em", ...rise(36) }}>
        {COPY.url}
      </div>
      <div style={{ position: "absolute", top: 1215, fontFamily: F.body, fontWeight: 500, fontSize: 42, color: "rgba(245,239,224,0.8)", ...rise(42) }}>
        {COPY.breaks}
      </div>
    </AbsoluteFill>
  );
};
