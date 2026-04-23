"use client";

// v2 LoadingScreen — splash that fits inside the Phone frame on desktop
// (390×844) and fills the screen on mobile. /assets/surfer.mp4 loops
// muted under a pale-blue veil; italic-serif "Should You Surf?" wordmark,
// animated SVG wave, pulsing dots, uppercase tagline.
// Also tears down the static #__preload splash from layout.js the moment
// React hydrates so this splash is what the user actually sees (otherwise
// the static preload sits on top for ~1.5s and the video gets maybe 800ms
// of screen time before the app appears).

import { useEffect } from "react";
import Phone from "./Phone";

export default function LoadingScreen({ tagline = "Reading the ocean…" }) {
  useEffect(() => {
    // Nuke the layout.js static preload as soon as we mount.
    // Belt-and-braces: add .gone for the CSS fade, signal __appReady so the
    // inline poller inside layout.js doesn't try to reattach it, then yank
    // the node out of the DOM after the fade completes.
    const preload = document.getElementById("__preload");
    if (preload) {
      preload.classList.add("gone");
      setTimeout(() => preload.parentNode && preload.parentNode.removeChild(preload), 240);
    }
    if (typeof window !== "undefined") window.__appReady = true;
  }, []);

  return (
    <Phone>
      <div className="v2-ls">
        <video
          className="v2-ls-video"
          src="/assets/surfer.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // fetchpriority is a hint — browsers that support it start the
          // video download with high priority alongside the JS bundle.
          // eslint-disable-next-line react/no-unknown-property
          fetchpriority="high"
          aria-hidden="true"
        />
        <div className="v2-ls-veil" aria-hidden="true"/>
        <div className="v2-ls-inner">
          <h1 className="v2-ls-title">Should You Surf?</h1>
          <svg className="v2-ls-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0,20 Q25,5 50,20 T100,20 T150,20 T200,20"
              fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            >
              <animate attributeName="d" dur="3s" repeatCount="indefinite"
                values="M0,20 Q25,5 50,20 T100,20 T150,20 T200,20;
                        M0,20 Q25,35 50,20 T100,20 T150,20 T200,20;
                        M0,20 Q25,5 50,20 T100,20 T150,20 T200,20"/>
            </path>
            <path
              d="M0,28 Q25,18 50,28 T100,28 T150,28 T200,28"
              fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"
            >
              <animate attributeName="d" dur="4.2s" repeatCount="indefinite"
                values="M0,28 Q25,38 50,28 T100,28 T150,28 T200,28;
                        M0,28 Q25,18 50,28 T100,28 T150,28 T200,28;
                        M0,28 Q25,38 50,28 T100,28 T150,28 T200,28"/>
            </path>
          </svg>
          <div className="v2-ls-dots" aria-hidden="true">
            <span/><span/><span/>
          </div>
          <p className="v2-ls-tagline">{tagline}</p>
        </div>
      </div>
    </Phone>
  );
}
