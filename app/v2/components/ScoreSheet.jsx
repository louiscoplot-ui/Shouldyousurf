"use client";

// v2 ScoreSheet — modal explainer with breakdown. Portaled to document.body
// so position:fixed escapes the phone frame and the .viewport scroll
// container (otherwise on mobile the sheet ends up at the bottom of the
// scrolled page instead of docked to the window bottom).

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { scoreBreakdown, SCORE_SCALE } from "../lib/verdict";

const FACTOR_LABEL_KEY = {
  size: "sheet_size_label",
  period: "sheet_period_label",
  dir: "sheet_dir_label",
  wind: "sheet_wind_label",
  tide: "sheet_tide_label",
};

export default function ScoreSheet({ hour, verdict, onClose, userLevel, boardRec, sessionNotes, spot, t }) {
  // i18n fallback : si t() ne reçoit pas de key (consommateur sans i18n
  // wrapper) on retombe sur la chaîne brute. Toutes les copies du sheet
  // passent par tt() qui combine t + interpolation.
  const tt = (key, vars) => {
    const raw = (t && t(key)) || key;
    if (!vars) return raw;
    return Object.keys(vars).reduce((acc, k) => acc.replaceAll(`{${k}}`, vars[k]), raw);
  };

  const bd = useMemo(() => scoreBreakdown(hour, spot, userLevel), [hour, spot, userLevel]);
  const scale = SCORE_SCALE;
  // bd.total est déjà le score scoreV2 pour ce niveau (sans le verdict
  // ceiling de scoreForLevel). hour.score peut différer de bd.total à
  // cause du ceiling SKIP/MAYBE — on affiche hour.score (ce que l'écran
  // principal montre) et on note dans le breakdown si un cap a été appliqué.
  const displayScore = (hour.score != null) ? hour.score : bd.total;
  const levelLabel = (t && t("lvl_" + userLevel)) || userLevel || "intermediate";
  const sizeFactor = bd.factors[0];
  const multFactors = bd.factors.slice(1);
  const rawV2 = Math.round(sizeFactor.pts * bd.multipliers.combined);

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
          <div className="sheet-eyebrow mono">{tt("sheet_eyebrow")}</div>
          <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="sheet-bignum">
          <span className="sheet-num" style={{ color: verdict.color }}>{displayScore}</span>
          <span className="sheet-den">/100</span>
          <span className="sheet-verd" style={{ color: verdict.color }}>{verdict.label}</span>
        </div>
        <div className="sheet-level-note">
          {tt("sheet_level_note", { level: levelLabel })}
        </div>

        {boardRec && boardRec.long && (
          <div className="sheet-board-rec">
            <div className="sheet-eyebrow mono">{tt("sheet_board")}</div>
            <div className="sheet-board-short">{boardRec.short}</div>
            <div className="sheet-board-long">{boardRec.long}</div>
          </div>
        )}

        {sessionNotes && sessionNotes.length > 0 && (
          <div className="sheet-notes">
            <div className="sheet-eyebrow mono">{tt("sheet_headsup")}</div>
            <ul className="sheet-notes-list">
              {sessionNotes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

        <div className="sheet-intro">{tt("sheet_intro")}</div>

        <div className="sheet-bars">
          {/* Size base — barre pleine /100 calibrée pour le niveau */}
          <div key={sizeFactor.key} className="sf-row">
            <div className="sf-top">
              <span className="sf-label">{tt(FACTOR_LABEL_KEY.size)}</span>
              <span className="sf-value mono">{sizeFactor.value}</span>
              <span className="sf-pts mono"><b>{sizeFactor.pts}</b><span className="sf-max">/100</span></span>
            </div>
            <div className="sf-bar">
              <div className="sf-fill" style={{ width: `${sizeFactor.pts}%`, background: verdict.color }}/>
            </div>
            <div className="sf-note">{sizeFactor.note}</div>
          </div>

          {/* Multiplicateurs : period / dir / wind / tide. Chaque ligne
              affiche le ratio en pourcentage signé (ex. "+25% boost",
              "−15% penalty", "neutral") — plus parlant qu'un ×ratio brut
              pour un surfeur non-tech. La barre reste centrée sur 1.00,
              clamp visuel [0.40, 1.35]. */}
          {multFactors.map((f) => {
            const m = f.mult ?? 1.00;
            const pct = Math.max(0, Math.min(100, ((m - 0.40) / 0.95) * 100));
            const deltaPct = Math.round((m - 1.0) * 100);
            const ratioLabel = deltaPct > 1 ? `+${deltaPct}%`
                             : deltaPct < -1 ? `${deltaPct}%`
                             : "neutral";
            const noteSuffix = deltaPct > 1 ? ` (${tt("sheet_mult_boost")})`
                              : deltaPct < -1 ? ` (${tt("sheet_mult_penalty")})`
                              : "";
            return (
              <div key={f.key} className="sf-row">
                <div className="sf-top">
                  <span className="sf-label">{tt(FACTOR_LABEL_KEY[f.key])}</span>
                  <span className="sf-value mono">{f.value}</span>
                  <span className="sf-pts mono"><b>{ratioLabel}</b></span>
                </div>
                <div className="sf-bar">
                  <div className="sf-fill" style={{ width: `${pct}%`, background: m >= 1.0 ? verdict.color : "#a0a0a0" }}/>
                </div>
                <div className="sf-note">{f.note}{noteSuffix}</div>
              </div>
            );
          })}

          {/* Combined multiplier + verdict ceiling display */}
          <div className="sf-row sf-row--adjust">
            <div className="sf-top">
              <span className="sf-label">{tt("sheet_combined_label")}</span>
              <span className="sf-value mono">{tt("sheet_combined_value")}</span>
              <span className="sf-pts mono" style={{ color: verdict.color }}>×<b>{bd.multipliers.combined.toFixed(2)}</b></span>
            </div>
            <div className="sf-note">
              {tt("sheet_combined_note", { base: sizeFactor.pts, mult: bd.multipliers.combined.toFixed(2), raw: rawV2 })}
            </div>
          </div>

          {(() => {
            // bd.total = scoreV2 post-safety-caps (déjà clampé). rawV2
            // = baseSize × multCombiné AVANT safety. displayScore =
            // hour.score = scoreForLevel post-verdict-ceiling. Donc :
            //   rawV2 > bd.total → safety cap a réduit
            //   bd.total > displayScore → verdict ceiling a réduit
            const safetyDelta = rawV2 - bd.total;     // positif si safety a tapé
            const verdictDelta = bd.total - displayScore;  // positif si verdict a tapé
            if (safetyDelta <= 1 && verdictDelta <= 1) return null;
            const note = verdictDelta > 1
              ? tt("sheet_verdict_cap", { label: verdict.label, level: levelLabel })
              : tt("sheet_safety_cap");
            return (
              <div className="sf-row sf-row--adjust">
                <div className="sf-top">
                  <span className="sf-label">{tt("sheet_cap_label")}</span>
                  <span className="sf-value mono">{levelLabel}</span>
                  <span className="sf-pts mono" style={{ color: verdict.color }}><b>{displayScore}</b><span className="sf-max">/100</span></span>
                </div>
                <div className="sf-note">{note}</div>
              </div>
            );
          })()}
        </div>

        <div className="sheet-scale">
          <div className="sheet-eyebrow mono" style={{ marginBottom: 8 }}>{tt("sheet_bands")}</div>
          {scale.map((s, i) => (
            <div key={i} className="ssc-row">
              <span className="ssc-dot" style={{ background: s.color }}/>
              <span className="ssc-range mono">{s.min}–{s.max}</span>
              <span className="ssc-name" style={{ color: s.color }}>{s.label}</span>
              <span className="ssc-sub">{s.sub}</span>
            </div>
          ))}
        </div>

        <button className="sheet-cta" onClick={onClose}>{tt("sheet_cta")}</button>
      </div>
    </div>,
    document.body,
  );
}
