// 10-11.5s — a real screenshot of the app (scripts/screenshots.mjs), so
// people recognise it in the store / on the web.
import React from "react";
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, monoLabel } from "../theme.js";
import { COPY } from "../data.js";

export const AppPhone = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = spring({ frame, fps, config: { damping: 15, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.navy} 0%, ${C.navyDeep} 100%)`, alignItems: "center" }}>
      <div style={{ position: "absolute", top: 240, ...monoLabel, fontSize: 32, color: C.amber, opacity: up }}>{COPY.appCaption}</div>
      <div
        style={{
          position: "absolute", top: 330, width: 700, height: 1420, borderRadius: 96, background: "#05080d",
          padding: 22, boxSizing: "border-box", boxShadow: "0 50px 120px rgba(0,0,0,0.5)",
          transform: `translateY(${(1 - up) * 900}px) rotate(${(1 - up) * 6}deg)`,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 76, overflow: "hidden", background: C.paper }}>
          <Img src={staticFile("app-screenshot.png")} style={{ width: "100%", display: "block" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
