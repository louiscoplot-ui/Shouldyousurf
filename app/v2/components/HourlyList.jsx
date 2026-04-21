"use client";

// v2 HourlyList — each row can expand inline with more detail.
// Ported from export-v2/v2-parts.jsx.

import { useState } from "react";
import { coherentVerdict } from "../lib/verdict";
import { fmtHour } from "../lib/hooks";

export default function HourlyList({ hours, selectedIdx, onSelect, currentHour }) {
  const [openIdx, setOpenIdx] = useState(null);
  const handleClick = (i) => {
    onSelect(i);
    setOpenIdx((o) => (o === i ? null : i));
  };
  return (
    <div className="hly">
      <div className="hly-h">
        <span className="t">Hourly</span>
        <span className="i">ⓘ</span>
      </div>
      <div>
        {hours.map((h, i) => {
          const v = coherentVerdict(h);
          const wpct = Math.max(4, h.score);
          const past = h.hour < currentHour;
          const isOpen = openIdx === i;
          return (
            <div key={i} className={`hly-row-wrap ${isOpen ? "open" : ""}`}>
              <div
                className={`hly-row ${selectedIdx === i ? "selected" : ""} ${past ? "past" : ""}`}
                onClick={() => handleClick(i)}
              >
                <div className="hly-time">{fmtHour(h.hour)}</div>
                <div className="hly-bar">
                  <div className="hly-fill" style={{ width: wpct + "%", background: v.color, animationDelay: `${i * 0.015}s` }}/>
                </div>
                <div className="hly-right">
                  <div style={{ textAlign: "right" }}>
                    <div className="hly-score" style={{ color: v.color }}>{h.score}</div>
                    <div className="hly-verd" style={{ color: v.color }}>{v.label.toUpperCase()}</div>
                  </div>
                  <div className="hly-meta">{h.faceFtLow}-{h.faceFtHigh}ft<br/>{Math.round(h.windKmh)}km/h</div>
                </div>
              </div>
              <div className={`hly-expand ${isOpen ? "open" : ""}`}>
                <div className="hly-expand-inner">
                  <div className="hly-ex-grid">
                    <div>
                      <div className="m-lbl">Swell</div>
                      <div className="hly-ex-val">{h.swellHeight.toFixed(1)}<span className="unit">m</span></div>
                      <div className="hly-ex-sub">{h.swellDir} · {Math.round(h.swellPeriod)}s</div>
                    </div>
                    <div>
                      <div className="m-lbl">Wind</div>
                      <div className="hly-ex-val">{Math.round(h.windKmh)}<span className="unit">km/h</span></div>
                      <div className="hly-ex-sub">{h.windDir} · {h.windType}</div>
                    </div>
                    <div>
                      <div className="m-lbl">Face</div>
                      <div className="hly-ex-val">{h.faceFtLow}–{h.faceFtHigh}<span className="unit">ft</span></div>
                      <div className="hly-ex-sub">{(h.swellHeight * 0.9).toFixed(1)}m face</div>
                    </div>
                    <div>
                      <div className="m-lbl">Score</div>
                      <div className="hly-ex-val" style={{ color: v.color }}>{h.score}</div>
                      <div className="hly-ex-sub" style={{ color: v.color }}>{v.label}</div>
                    </div>
                  </div>
                  <div className="hly-ex-note">{v.sub}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
