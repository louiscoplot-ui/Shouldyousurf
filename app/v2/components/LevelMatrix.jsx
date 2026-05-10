"use client";

// v2 LevelMatrix — unified with the main score. Delegates row-by-row
// verdict + reason to the same classifyConditions / getPersonalVerdict
// the sticky tip uses, so "Can you surf?" can't disagree with the top
// of the screen any more.

import { levelMatrixFor } from "../lib/verdict";
import {
  classifyConditions,
  getPersonalVerdict,
  hasInsideReform,
} from "../lib/prodScoring";

const FNS = { classifyConditions, getPersonalVerdict, hasInsideReform };

export default function LevelMatrix({ hour, spot, t }) {
  const m = levelMatrixFor(hour, spot, FNS);
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
        <div key={i} className="lvl-row">
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
