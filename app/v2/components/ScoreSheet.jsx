"use client";

// v2 ScoreSheet — modal explainer with breakdown. Ported from export-v2/v2-parts.jsx.

import { scoreBreakdown, SCORE_SCALE } from "../lib/verdict";

export default function ScoreSheet({ hour, verdict, onClose }) {
  const bd = scoreBreakdown(hour);
  const scale = SCORE_SCALE;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip"/>
        <div className="sheet-head">
          <div className="sheet-eyebrow mono">HOW THIS SCORE IS BUILT</div>
          <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sheet-bignum">
          <span className="sheet-num" style={{ color: verdict.color }}>{bd.total}</span>
          <span className="sheet-den">/100</span>
          <span className="sheet-verd" style={{ color: verdict.color }}>{verdict.label}</span>
        </div>
        <div className="sheet-intro">
          We weigh <b>size</b>, <b>swell period</b>, <b>swell direction</b> and <b>wind</b> against this spot's profile. Long-period groundswell with light offshore wind scores highest.
        </div>

        <div className="sheet-bars">
          {bd.factors.map((f) => (
            <div key={f.key} className="sf-row">
              <div className="sf-top">
                <span className="sf-label">{f.label}</span>
                <span className="sf-value mono">{f.value}</span>
                <span className="sf-pts mono"><b>{f.pts}</b><span className="sf-max">/{f.max}</span></span>
              </div>
              <div className="sf-bar">
                <div className="sf-fill" style={{ width: `${(f.pts / f.max) * 100}%`, background: verdict.color }}/>
              </div>
              <div className="sf-note">{f.note}</div>
            </div>
          ))}
        </div>

        <div className="sheet-scale">
          <div className="sheet-eyebrow mono" style={{ marginBottom: 8 }}>SCORE BANDS</div>
          {scale.map((s, i) => (
            <div key={i} className="ssc-row">
              <span className="ssc-dot" style={{ background: s.color }}/>
              <span className="ssc-range mono">{s.min}–{s.max}</span>
              <span className="ssc-name" style={{ color: s.color }}>{s.label}</span>
              <span className="ssc-sub">{s.sub}</span>
            </div>
          ))}
        </div>

        <button className="sheet-cta" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
