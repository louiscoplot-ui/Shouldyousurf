// Layered, moving swell lines. Pure function of the frame (no randomness),
// so every render is identical.
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

export function wavePath({ width, height, baseY, amp, length, phase, amp2 = 0, length2 = 1, phase2 = 0 }) {
  const step = 12;
  let d = `M0,${height} L0,${baseY}`;
  for (let x = 0; x <= width + step; x += step) {
    const y =
      baseY +
      amp * Math.sin((x / length) * 2 * Math.PI + phase) +
      amp2 * Math.sin((x / length2) * 2 * Math.PI + phase2);
    d += ` L${x},${y.toFixed(1)}`;
  }
  return `${d} L${width + step},${height} Z`;
}

// layers: [{ y, amp, length, speed, color, opacity? }]  (y = baseline in px)
export const Waves = ({ layers, style }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, ...style }}>
      {layers.map((l, i) => (
        <path
          key={i}
          d={wavePath({
            width, height,
            baseY: typeof l.y === "function" ? l.y(frame) : l.y,
            amp: l.amp, length: l.length, phase: frame * l.speed + i * 1.7,
            amp2: l.amp * 0.35, length2: l.length * 0.45, phase2: -frame * l.speed * 1.6 + i,
          })}
          fill={l.color}
          opacity={l.opacity ?? 1}
        />
      ))}
    </svg>
  );
};
