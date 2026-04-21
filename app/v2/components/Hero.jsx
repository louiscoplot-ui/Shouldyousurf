"use client";

// v2 Hero components — VerdictHero, FaceHeightHero, WaveGlyph.
// Ported as-is from export-v2/v2-parts.jsx.

import { useTween } from "../lib/hooks";

export function VerdictHero({ verdict, hour, swapKey, onOpenScore }) {
  const score = Math.round(useTween(hour.score, 380));
  return (
    <div key={swapKey} className="swap-enter">
      <div className="verdict-row">
        <div className="verdict-word" style={{ color: verdict.color }}>{verdict.label}</div>
        <button
          className="score-box"
          onClick={onOpenScore}
          style={{ borderColor: verdict.color + "55" }}
        >
          <span className="score-num" style={{ color: verdict.color }}>{score}</span>
          <span className="score-den">/100</span>
          <span className="score-info" aria-hidden="true">ⓘ</span>
        </button>
      </div>
    </div>
  );
}

export function WaveGlyph({ heightFt }) {
  const amp = Math.max(2, Math.min(10, heightFt * 0.9));
  return (
    <svg width="150" height="34" viewBox="0 0 150 34" style={{ display: "block", margin: "10px auto 0" }}>
      <defs>
        <linearGradient id="wg" x1="0" x2="1">
          <stop offset="0" stopColor="rgba(45,122,110,0)"/>
          <stop offset="0.3" stopColor="rgba(45,122,110,0.55)"/>
          <stop offset="0.7" stopColor="rgba(45,122,110,0.55)"/>
          <stop offset="1" stopColor="rgba(45,122,110,0)"/>
        </linearGradient>
      </defs>
      <path d={`M0,17 Q25,${17 - amp} 50,17 T100,17 T150,17`} fill="none" stroke="url(#wg)" strokeWidth="1.6" strokeLinecap="round">
        <animate
          attributeName="d"
          dur="4s"
          repeatCount="indefinite"
          values={`M0,17 Q25,${17 - amp} 50,17 T100,17 T150,17;
                   M0,17 Q25,${17 + amp} 50,17 T100,17 T150,17;
                   M0,17 Q25,${17 - amp} 50,17 T100,17 T150,17`}
        />
      </path>
      <path d={`M0,23 Q25,${23 - amp * 0.7} 50,23 T100,23 T150,23`} fill="none" stroke="rgba(45,122,110,0.25)" strokeWidth="1.2" strokeLinecap="round">
        <animate
          attributeName="d"
          dur="5.5s"
          repeatCount="indefinite"
          values={`M0,23 Q25,${23 + amp * 0.7} 50,23 T100,23 T150,23;
                   M0,23 Q25,${23 - amp * 0.7} 50,23 T100,23 T150,23;
                   M0,23 Q25,${23 + amp * 0.7} 50,23 T100,23 T150,23`}
        />
      </path>
    </svg>
  );
}

export function FaceHeightHero({ hour, swapKey }) {
  const low = hour.faceFtLow, high = hour.faceFtHigh;
  const midM = hour.swellHeight.toFixed(1);
  const per = Math.round(hour.swellPeriod);
  const descriptors = [
    { max: 1.5, text: "Knee- to waist-high — beginner or longboard." },
    { max: 3,   text: "Waist to chest-high — easy, rolling waves." },
    { max: 5,   text: "Chest to head-high — proper intermediate waves, duck-diving required." },
    { max: 7,   text: "Head to overhead — solid and powerful." },
    { max: 12,  text: "Well overhead — experienced surfers only." },
  ];
  const trans = descriptors.find((d) => high <= d.max)?.text || "Well overhead — experts only.";
  return (
    <div key={swapKey} className="fh-block swap-enter">
      <div className="fh-lbl">Expected face height</div>
      <div className="fh-val">{low}–{high}<span className="unit">ft</span></div>
      <WaveGlyph heightFt={(low + high) / 2}/>
      <div className="fh-conv">{midM} m · {(hour.swellHeight * 0.9).toFixed(1)}m @ {per}s</div>
      <div className="fh-trans">{trans}</div>
    </div>
  );
}
