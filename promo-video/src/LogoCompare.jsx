// Review-only composition: the original icon-512.png next to the SVG redraw,
// plus the redraw overlaid on the PNG at 50% to check the geometry.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Logo } from "./Logo.jsx";

const label = { color: "#e7e2d3", fontFamily: "sans-serif", fontSize: 26, textAlign: "center", marginTop: 14 };

export const LogoCompare = () => (
  <AbsoluteFill style={{ background: "#1b1f24", flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
    <div>
      <Img src={staticFile("icon-512.png")} style={{ width: 512, height: 512, display: "block" }} />
      <div style={label}>icon-512.png (original)</div>
    </div>
    <div>
      <Logo size={512} background="icon" radius={96} />
      <div style={label}>SVG redraw</div>
    </div>
    <div style={{ position: "relative" }}>
      <Img src={staticFile("icon-512.png")} style={{ width: 512, height: 512, display: "block" }} />
      <div style={{ position: "absolute", top: 0, left: 0, opacity: 0.55 }}>
        <Logo size={512} color="#ff3b6b" />
      </div>
      <div style={label}>overlay (red = redraw)</div>
    </div>
  </AbsoluteFill>
);
