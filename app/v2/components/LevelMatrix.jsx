"use client";

// v2 LevelMatrix — ported from export-v2/v2-parts.jsx.

import { levelMatrixFor } from "../lib/verdict";

export default function LevelMatrix({ hour }) {
  const m = levelMatrixFor(hour);
  const text = { yes: "GO", ok: "WORTH IT", no: "SKIP" };
  return (
    <div className="lvl-block">
      <div className="lvl-head">
        <span className="lvl-h">Can you surf?</span>
        <button className="lvl-me-btn">
          Your level <span className="chev">▾</span>
        </button>
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
