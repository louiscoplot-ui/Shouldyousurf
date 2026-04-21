"use client";

// v2 CustomLangModal — lets power users add a language with their own translations.

import { useState } from "react";
import { EN_TEMPLATE } from "../../i18n";

export default function CustomLangModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [flag, setFlag] = useState("");
  const [json, setJson] = useState(() => JSON.stringify(EN_TEMPLATE, null, 2));
  const [err, setErr] = useState("");

  function handleSave() {
    if (!name.trim() || !code.trim()) { setErr("Name and code are required."); return; }
    try {
      const translations = JSON.parse(json);
      onSave({ code: code.trim().toLowerCase(), name: name.trim(), flag: flag.trim() || "🌐", translations });
    } catch {
      setErr("Invalid JSON — check your syntax.");
    }
  }

  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-sheet" onClick={e => e.stopPropagation()}>
        <div className="v2-handle"/>
        <div className="v2-sheet-body">
          <div className="v2-sheet-header">
            <div className="v2-sheet-title">Add Language</div>
            <button className="v2-close-btn" onClick={onClose}>✕</button>
          </div>
          <p className="v2-sheet-sub" style={{ marginBottom: 14 }}>
            Edit the JSON values below. Keep the keys unchanged.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 60px", gap: 8, marginBottom: 12 }}>
            <input className="v2-input" value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Arabic)"/>
            <input className="v2-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Code (e.g. ar)"/>
            <input className="v2-input" value={flag} onChange={e => setFlag(e.target.value)} placeholder="🌐" style={{ textAlign: "center" }}/>
          </div>
          <textarea
            className="v2-input"
            value={json}
            onChange={e => { setJson(e.target.value); setErr(""); }}
            style={{ width: "100%", height: 260, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, lineHeight: 1.6 }}
            spellCheck={false}
          />
          {err && <div style={{ color: "var(--bad)", fontSize: 11, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>{err}</div>}
          <button className="v2-primary-btn" style={{ marginTop: 14 }} onClick={handleSave}>Save Language</button>
          <button className="v2-secondary-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
