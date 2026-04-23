"use client";

// v2 FaqSheet — same FAQ content as prod, wrapped in v2 visuals.

import { useState } from "react";

const FAQ_KEYS = [
  { q: "faq_q1", a: "faq_a1" },
  { q: "faq_q2", a: "faq_a2" },
  { q: "faq_q3", a: "faq_a3" },
  { q: "faq_q4", a: null, parts: ["faq_a4_ios", "faq_a4_android"] },
  { q: "faq_q5", a: "faq_a5" },
  { q: "faq_q6", a: "faq_a6" },
  { q: "faq_q7", a: "faq_a7" },
  { q: "faq_q8", a: "faq_a8" },
  { q: "faq_q9", a: "faq_a9" },
  { q: "faq_q10", a: "faq_a10" },
  { q: "faq_q11", a: "faq_a11" },
  { q: "faq_q12", a: "faq_a12" },
];

export default function FaqSheet({ onClose, t }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">{t("faq_title")}</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          {FAQ_KEYS.map((item, i) => (
            <div key={i} className="v2-faq-item">
              <button className="v2-faq-q" onClick={() => setOpen(open === i ? null : i)}>
                <span>{t(item.q)}</span>
                <span className="v2-faq-chev">{open === i ? "▴" : "▾"}</span>
              </button>
              {open === i && (
                <div className="v2-faq-a">
                  {item.a ? t(item.a) : item.parts.map((p, j) => (
                    <div key={j} style={{ marginTop: j > 0 ? 6 : 0 }}>
                      <span style={{ color: "var(--accent)", marginRight: 6, fontWeight: 600 }}>{j === 0 ? "iOS:" : "Android:"}</span>
                      {t(p)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
