"use client";

// v2 OnboardingModal — appears on first visit. Lets the user pick a level
// so the per-level advice can be tailored from minute one.

import { USER_LEVELS } from "../lib/prodScoring";

export default function OnboardingModal({ onPick, onSkip, t }) {
  return (
    <div className="v2-overlay" onClick={onSkip}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div style={{ textAlign: "center", paddingTop: 10, paddingBottom: 6 }}>
            <div className="serif" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--accent)" }}>
              {t("onboarding_title")}
            </div>
            <p style={{ fontSize: 14, color: "var(--text-mu)", margin: "8px 0 14px", lineHeight: 1.45 }}>{t("onboarding_sub")}</p>
          </div>
          <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-ring)", borderRadius: 8, padding: "10px 12px", margin: "0 0 16px", fontSize: 13, color: "var(--text)", lineHeight: 1.45 }}>
            {t("onboarding_spot_hint")}
          </div>
          {USER_LEVELS.map(lvl => (
            <button key={lvl} className="v2-level-item" onClick={() => onPick(lvl)}>
              <div style={{ flex: 1 }}>
                <div className="v2-level-item-title">{t("lvl_" + lvl)}</div>
                <div className="v2-level-item-sub">{t("lvl_" + lvl + "_sub")}</div>
              </div>
            </button>
          ))}
          <button className="v2-level-item v2-level-item-clear" onClick={onSkip}>
            <div className="v2-level-item-title">{t("onboarding_skip")}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
