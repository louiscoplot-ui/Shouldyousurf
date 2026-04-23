"use client";

// v2 LevelMatrix — unified with the main score. Delegates row-by-row
// verdict + reason to the same classifyConditions / getPersonalVerdict
// the sticky tip uses, so "Can you surf?" can't disagree with the top
// of the screen any more.

import { levelMatrixFor } from "../lib/verdict";
import {
  classifyConditions,
  getPersonalVerdict,
  isFoamieFriendly,
} from "../lib/prodScoring";

const FNS = { classifyConditions, getPersonalVerdict, isFoamieFriendly };

export default function LevelMatrix({ hour, spot }) {
  const m = levelMatrixFor(hour, spot, FNS);
  const text = { yes: "GO", ok: "WORTH IT", no: "SKIP" };
  return (
    <div className="lvl-block">
      <div className="lvl-head">
        <span className="lvl-h">Can you surf?</span>
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
