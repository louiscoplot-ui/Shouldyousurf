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

export default function ScoreSheet({ hour, verdict, onClose, userLevel, boardRec, sessionNotes, spot }) {
  const bd = scoreBreakdown(hour, spot, userLevel);
  const scale = SCORE_SCALE;
  // bd.total est déjà le score scoreV2 pour ce niveau (sans le verdict
  // ceiling de scoreForLevel). hour.score peut différer de bd.total à
  // cause du ceiling SKIP/MAYBE — on affiche hour.score (ce que l'écran
  // principal montre) et on note dans le breakdown si un cap a été appliqué.
  const displayScore = (hour.score != null) ? hour.score : bd.total;
  const levelLabel = LEVEL_LABELS[userLevel] || "Intermediate";
  const sizeFactor = bd.factors[0];
  const multFactors = bd.factors.slice(1);

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
          La taille pour <b>ton niveau</b> donne le score de base. Période, direction, vent et marée le multiplient — ils ajustent dans la bande de taille, jamais au-dessus.
        </div>

        <div className="sheet-bars">
          {/* Size base — barre pleine /100 calibrée pour le niveau */}
          <div key={sizeFactor.key} className="sf-row">
            <div className="sf-top">
              <span className="sf-label">{sizeFactor.label}</span>
              <span className="sf-value mono">{sizeFactor.value}</span>
              <span className="sf-pts mono"><b>{sizeFactor.pts}</b><span className="sf-max">/100</span></span>
            </div>
            <div className="sf-bar">
              <div className="sf-fill" style={{ width: `${sizeFactor.pts}%`, background: verdict.color }}/>
            </div>
            <div className="sf-note">{sizeFactor.note}</div>
          </div>

          {/* Multiplicateurs : period / dir / wind / tide. Chaque ligne
              montre ×ratio (ex. ×1.25) avec une barre proportionnelle
              autour du neutre 1.00, capée [0.40, 1.35]. */}
          {multFactors.map((f) => {
            const m = f.mult ?? 1.00;
            // Barre centrée sur 1.00, range visuel [0.40, 1.35] → [0%, 100%]
            const pct = Math.max(0, Math.min(100, ((m - 0.40) / 0.95) * 100));
            const sign = m > 1.005 ? "+" : "";
            return (
              <div key={f.key} className="sf-row">
                <div className="sf-top">
                  <span className="sf-label">{f.label}</span>
                  <span className="sf-value mono">{f.value}</span>
                  <span className="sf-pts mono">×<b>{m.toFixed(2)}</b></span>
                </div>
                <div className="sf-bar">
                  <div className="sf-fill" style={{ width: `${pct}%`, background: m >= 1.0 ? verdict.color : "#a0a0a0" }}/>
                </div>
                <div className="sf-note">{f.note}{sign && m > 1.0 ? " (boost)" : ""}{m < 1.0 ? " (penalty)" : ""}</div>
              </div>
            );
          })}

          {/* Combined multiplier + verdict ceiling display */}
          <div className="sf-row sf-row--adjust">
            <div className="sf-top">
              <span className="sf-label">Combined multiplier</span>
              <span className="sf-value mono">cap [0.40, 1.35]</span>
              <span className="sf-pts mono" style={{ color: verdict.color }}>×<b>{bd.multipliers.combined.toFixed(2)}</b></span>
            </div>
            <div className="sf-note">
              {sizeFactor.pts} × {bd.multipliers.combined.toFixed(2)} = {Math.round(sizeFactor.pts * bd.multipliers.combined)} avant safety / verdict cap.
            </div>
          </div>

          {(() => {
            const rawV2 = Math.round(sizeFactor.pts * bd.multipliers.combined);
            const safetyCapped = Math.min(rawV2, bd.total) - bd.total !== 0 ? Math.min(rawV2, 100) - bd.total : 0;
            const verdictDelta = displayScore - bd.total;
            if (verdictDelta === 0 && safetyCapped === 0) return null;
            const note = verdictDelta < 0
              ? `Verdict ${verdict.label.toLowerCase()} pour ${levelLabel.toLowerCase()} → score plafonné. La taille / vent / current sortent de la bande viable pour ton niveau.`
              : safetyCapped !== 0
                ? `Safety: micro swell ou onshore gale → cap appliqué.`
                : null;
            if (!note) return null;
            return (
              <div className="sf-row sf-row--adjust">
                <div className="sf-top">
                  <span className="sf-label">Verdict / safety cap</span>
                  <span className="sf-value mono">{levelLabel}</span>
                  <span className="sf-pts mono" style={{ color: verdict.color }}><b>{displayScore}</b><span className="sf-max">/100</span></span>
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
