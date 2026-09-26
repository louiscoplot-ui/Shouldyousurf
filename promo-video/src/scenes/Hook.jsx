// 0-3s — dawn over the water, the question every surfer asks.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, displayStyle, monoLabel } from "../theme.js";
import { Waves } from "../Waves.jsx";
import { COPY } from "../data.js";

const LINES = [COPY.hook.slice(0, 3), COPY.hook.slice(3)]; // "Is it worth" / "paddling out?"

export const Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const light = interpolate(frame, [0, 90], [0, 1], { extrapolateRight: "clamp" });
  const sunY = interpolate(frame, [0, 90], [1300, 1180], { extrapolateRight: "clamp" });
  let wordIndex = 0;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${C.navyDeep} 0%, ${C.navy} ${30 - light * 8}%, #6b4a7a ${58 - light * 6}%, ${C.coral} ${74 - light * 4}%, ${C.honey} 86%)`,
      }}
    >
      {/* sun */}
      <div
        style={{
          position: "absolute", left: 540 - 170, top: sunY - 170, width: 340, height: 340, borderRadius: "50%",
          background: `radial-gradient(circle, #ffe2a8 0%, ${C.honey} 55%, rgba(217,158,74,0) 72%)`,
          opacity: 0.9,
        }}
      />
      <Waves
        layers={[
          { y: 1290, amp: 10, length: 520, speed: 0.05, color: "#274a7a", opacity: 0.9 },
          { y: 1350, amp: 16, length: 640, speed: 0.07, color: "#1b3a66" },
          { y: 1450, amp: 22, length: 760, speed: 0.09, color: C.navy },
          { y: 1580, amp: 28, length: 900, speed: 0.11, color: C.navyDeep },
        ]}
      />
      <div style={{ position: "absolute", top: 330, left: 80, right: 80 }}>
        <div
          style={{
            ...monoLabel, color: C.amber, fontSize: 34,
            opacity: interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {COPY.hookSub}
        </div>
        <div style={{ ...displayStyle, color: C.cream, fontSize: 168, marginTop: 40 }}>
          {LINES.map((line, li) => (
            <div key={li} style={{ display: "flex", flexWrap: "wrap", columnGap: 36 }}>
              {line.map((word) => {
                const i = wordIndex++;
                const s = spring({ frame: frame - 8 - i * 7, fps, config: { damping: 14, mass: 0.6 } });
                const isLast = i === COPY.hook.length - 1;
                return (
                  <span
                    key={word}
                    style={{
                      display: "inline-block",
                      opacity: s,
                      transform: `translateY(${(1 - s) * 70}px)`,
                      color: isLast ? C.honey : C.cream,
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
