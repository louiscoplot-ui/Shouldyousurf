"use client";

// v2 LevelPicker — 6 user levels, ported from prod.
// Keeps v2's .overlay/.sheet visual but uses the same user-facing strings (i18n).

import { USER_LEVELS } from "../lib/prodScoring";

export default function LevelPicker({ userLevel, onPick, onClose, t }) {
  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">{t("level_picker_title")}</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          <p className="v2-sheet-sub">{t("level_picker_sub")}</p>
          {USER_LEVELS.map(lvl => (
            <button key={lvl} className={`v2-level-item ${userLevel === lvl ? "active" : ""}`}
              onClick={() => { onPick(lvl); onClose(); }}>
              <div style={{ flex: 1 }}>
                <div className="v2-level-item-title">{t("lvl_" + lvl)}</div>
                <div className="v2-level-item-sub">{t("lvl_" + lvl + "_sub")}</div>
              </div>
              {userLevel === lvl && <span className="v2-level-item-check">✓</span>}
            </button>
          ))}
          {userLevel && (
            <button className="v2-level-item v2-level-item-clear" onClick={() => { onPick(null); onClose(); }}>
              <div className="v2-level-item-title">{t("level_clear")}</div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
