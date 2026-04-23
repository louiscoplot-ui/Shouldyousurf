"use client";

// v2 LoadingScreen — splash that fits inside the Phone frame on desktop
// (390×844) and fills the screen on mobile. /assets/surfer.mp4 loops
// muted under a pale-blue veil; italic-serif "Should You Surf?" wordmark,
// animated SVG wave, pulsing dots, uppercase tagline.
//
// Owns its own dismiss timing so the video always gets MIN_PLAY_MS of
// actual playback time even if the video takes 500ms+ to start. Fires
// onReady() either when MIN_PLAY_MS has elapsed since the video started
// playing, or HARD_CEILING_MS since mount (network failure safeguard).
//
// Also tears down the static #__preload splash from layout.js the moment
// React hydrates so this splash is what the user actually sees.

import { useEffect, useRef, useState } from "react";
import Phone from "./Phone";

const MIN_PLAY_MS = 2500;       // video must play at least this long
const HARD_CEILING_MS = 5000;   // never block the app for more than this

export default function LoadingScreen({ tagline = "Reading the ocean…", onReady }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // Tear down the layout.js static preload — the video splash takes over.
    const preload = document.getElementById("__preload");
    if (preload) {
      preload.classList.add("gone");
      setTimeout(() => preload.parentNode && preload.parentNode.removeChild(preload), 240);
    }
    if (typeof window !== "undefined") window.__appReady = true;

    // Hard ceiling — always dismiss after HARD_CEILING_MS even if video never plays
    const ceiling = setTimeout(() => { if (onReady) onReady(); }, HARD_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, [onReady]);

  // Minimum playback timer — starts only when the video is actually playing,
  // so a slow-to-start video still gets MIN_PLAY_MS of screen time.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => { if (onReady) onReady(); }, MIN_PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, onReady]);

  return (
    <Phone>
      <div className="v2-ls">
        <video
          ref={videoRef}
          className="v2-ls-video"
          src="/assets/surfer.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // eslint-disable-next-line react/no-unknown-property
          fetchpriority="high"
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
          onCanPlay={() => {
            // Safari sometimes fires canplay before playing — try to start
            // playback explicitly so the timer starts as early as possible.
            const v = videoRef.current;
            if (v && v.paused) { v.play().catch(() => {}); }
          }}
          onError={() => {
            // Video file missing / blocked — dismiss the splash early so
            // the app isn't stuck behind a broken video.
            if (onReady) onReady();
          }}
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
