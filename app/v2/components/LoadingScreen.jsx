"use client";

// v2 LoadingScreen — full-bleed video splash shown during first data
// fetch. Video loops silently under a pale-blue veil; italic serif
// wordmark + animated SVG wave + pulsing dots + tagline layer on top.
// Gracefully degrades if /assets/surfer.mp4 isn't present (black bg with
// the brand still shown) so the app never breaks when the file is missing.

export default function LoadingScreen({ tagline = "Reading the ocean…" }) {
  return (
    <div className="v2-ls">
      <video
        className="v2-ls-video"
        src="/assets/surfer.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster=""
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
  );
}
