"use client";

// v2 DangerBanner — compact one-line "⚠️ Dangerous for your level [See more ›]".
// Renders only when the per-level verdict is "no" (SKIP) for a learner.
// Tap to expand inline and reveal the full advice text. Default state
// is collapsed (~44px tall instead of the v1 prod ~150px stacked alerts).

import { useState } from "react";

export default function DangerBanner({ message, detail }) {
  const [open, setOpen] = useState(false);
  if (!message) return null;
  return (
    <div className={`danger-pill ${open ? "open" : ""}`}>
      <button
        className="danger-pill-row"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="danger-pill-icon" aria-hidden="true">⚠</span>
        <span className="danger-pill-msg">{message}</span>
        {detail && (
          <span className="danger-pill-toggle">
            {open ? "Less" : "See more"} <span className="danger-pill-chev">{open ? "▴" : "▸"}</span>
          </span>
        )}
      </button>
      {detail && (
        <div className="danger-pill-detail">{detail}</div>
      )}
    </div>
  );
}
