import React from "react";
import { Composition } from "remotion";
import "./fonts.js";
import { Promo } from "./Promo.jsx";
import { LogoCompare } from "./LogoCompare.jsx";

export const RemotionRoot = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={450} fps={30} width={1080} height={1920} />
    {/* Review only: the original icon next to the SVG redraw. */}
    <Composition id="LogoCompare" component={LogoCompare} durationInFrames={1} fps={30} width={1800} height={640} />
  </>
);
