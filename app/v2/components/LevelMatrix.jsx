"use client";

// v2 LevelMatrix — unified with the main score. Delegates row-by-row
// verdict + reason to the same classifyConditions / getPersonalVerdict
// the sticky tip uses, so "Can you surf?" can't disagree with the top
// of the screen any more.

import { useMemo } from "react";
import { levelMatrixFor, LEVEL_TO_MATRIX_IDX } from "../lib/verdict";
import {
  classifyConditions,
  getPersonalVerdict,
  hasInsideReform,
} from "../lib/prodScoring";

const FNS = { classifyConditions, getPersonalVerdict, hasInsideReform };

export default function LevelMatrix({ hour, spot, userLevel, t }) {
  // Memo : éviter de recalculer 5 niveaux × classifyConditions à chaque
  // tick scroll/ago du parent (audit PERF #4).
  const m = useMemo(() => levelMatrixFor(hour, spot, FNS), [hour, spot]);
  // Index de la ligne correspondant au niveau utilisateur — pour highlight
  // "tu es ici". Le map LEVEL_TO_MATRIX_IDX collapse certains niveaux
  // (first_timer + beginner = ligne "Beginner", early_int + intermediate
  // = ligne "Early Int."). Sans ce repère, le user cherche sa ligne à
  // chaque consultation (audit UX #15).
  const currentIdx = userLevel != null ? LEVEL_TO_MATRIX_IDX[userLevel] : -1;
  // Verdict labels — pulled from i18n so they match the sticky-bar verdict
  // text in every language (FR: TENTE, ES: VALE LA PENA, JA: いけそう, etc.).
  // Without t() the matrix said "WORTH IT" while the sticky bar said
  // something else for the same state.
  const tt = typeof t === "function" ? t : ((k) => k);
  const text = {
    yes: tt("go") || "GO",
    ok: tt("maybe") || "MAYBE",
    no: tt("skip") || "SKIP",
  };
  return (
    <div className="lvl-block">
      <div className="lvl-head">
        <span className="lvl-h">{tt("can_you_surf") || "Can you surf?"}</span>
      </div>
      {m.map((l, i) => (
        <div key={i} className={`lvl-row${i === currentIdx ? " lvl-row--current" : ""}`}>
          <div>
            <div className="lvl-name">{l.name}</div>
            <div className="lvl-reason">{l.reason}</div>
          </div>
          <span className={`pill ${l.verdict}`}>{text[l.verdict]}</span>
        </div>
      ))}
    </div>
  );
}
