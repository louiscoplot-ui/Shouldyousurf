"use client";

// v2 ScoreSheet — modal explainer with breakdown. Portaled to document.body
// so position:fixed escapes the phone frame and the .viewport scroll
// container (otherwise on mobile the sheet ends up at the bottom of the
// scrolled page instead of docked to the window bottom).

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { scoreBreakdown, SCORE_SCALE } from "../lib/verdict";

const LEVEL_LABELS = {
  first_timer: "First-timer", beginner: "Beginner", early_int: "Early intermediate",
  intermediate: "Intermediate", advanced: "Advanced", expert: "Expert",
};

export default function ScoreSheet({ hour, verdict, onClose, userLevel, boardRec, sessionNotes }) {
  const bd = scoreBreakdown(hour);
  const scale = SCORE_SCALE;
  // Use the score actually shown on the main card (level-adjusted) rather
  // than the raw scoreBreakdown total, so the number here matches what the
  // user was just looking at.
  const displayScore = (hour.score != null) ? hour.score : bd.total;
  const levelLabel = LEVEL_LABELS[userLevel] || "Intermediate";

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip"/>
        <div className="sheet-head">
          <div className="sheet-eyebrow mono">HOW THIS SCORE IS BUILT</div>
          <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sheet-bignum">
          <span className="sheet-num" style={{ color: verdict.color }}>{displayScore}</span>
          <span className="sheet-den">/100</span>
          <span className="sheet-verd" style={{ color: verdict.color }}>{verdict.label}</span>
        </div>
        <div className="sheet-level-note">
          Scored for <b>{levelLabel}</b> — size zone, wind tolerance and current
          hazard are all calibrated for this level. Change level from the main
          screen to see how the same conditions read for other surfers.
        </div>

        {boardRec && boardRec.long && (
          <div className="sheet-board-rec">
            <div className="sheet-eyebrow mono">BOARD FOR THIS SESSION</div>
            <div className="sheet-board-short">{boardRec.short}</div>
            <div className="sheet-board-long">{boardRec.long}</div>
          </div>
        )}

        {sessionNotes && sessionNotes.length > 0 && (
          <div className="sheet-notes">
            <div className="sheet-eyebrow mono">HEADS-UP</div>
            <ul className="sheet-notes-list">
              {sessionNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

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
          {/* Level adjustment — the 4 bars above describe the ocean; this
              row reconciles their sum with the displayed score. If you're
              under-levelled for the size, or wind is tough for your skill,
              this number swings the final result. Without it users see
              bars summing to e.g. 74 but a final score of 1 and are
              (rightly) confused. */}
          {(() => {
            const oceanSum = bd.total;
            const levelAdjust = displayScore - oceanSum;
            if (levelAdjust === 0) return null;
            const sign = levelAdjust > 0 ? "+" : "";
            const note = levelAdjust < 0
              ? `Conditions are tough for ${levelLabel.toLowerCase()} — size, wind or current are beyond your comfort. Score capped accordingly.`
              : `Conditions happen to suit ${levelLabel.toLowerCase()} — size zone, clean wind. Score lifted.`;
            return (
              <div className="sf-row sf-row--adjust">
                <div className="sf-top">
                  <span className="sf-label">For your level</span>
                  <span className="sf-value mono">{levelLabel}</span>
                  <span className="sf-pts mono" style={{ color: verdict.color }}><b>{sign}{levelAdjust}</b></span>
                </div>
                <div className="sf-note">{note}</div>
              </div>
            );
          })()}
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
    </div>,
    document.body,
  );
}
