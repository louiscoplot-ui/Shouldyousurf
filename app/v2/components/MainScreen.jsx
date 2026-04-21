"use client";

// v2 MainScreen — ported from export-v2/v2-main.jsx.
// Uses mock data for now; swap in a real forecast fetch when wiring prod data.

import { useEffect, useMemo, useRef, useState } from "react";
import Phone from "./Phone";
import { VerdictHero } from "./Hero";
import StickyInfoBar from "./StickyInfoBar";
import { DrivingChips } from "./MetricCards";
import BestWindow from "./BestWindow";
import HourlyList from "./HourlyList";
import TideCurve from "./TideCurve";
import LevelMatrix from "./LevelMatrix";
import ScoreSheet from "./ScoreSheet";
import Footer from "./Footer";
import { useSwapKey, fmtHour } from "../lib/hooks";
import { coherentVerdict } from "../lib/verdict";
import { BREAKS_MOCK, makeForecast } from "../lib/mock";

export default function MainScreen() {
  const spot = BREAKS_MOCK[0];
  const days = useMemo(() => makeForecast(spot.id), [spot.id]);
  const [dayIdx, setDayIdx] = useState(() => {
    const i = days.findIndex((d) => d.label === "Today");
    return i >= 0 ? i : 0;
  });
  const day = days[dayIdx];
  const currentHour = 15;
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const i = day.hours.findIndex((h) => h.hour === currentHour);
    return i >= 0 ? i : day.hours.indexOf(day.bestHour);
  });
  useEffect(() => {
    const i = day.hours.findIndex((h) => h.hour === currentHour);
    setSelectedIdx(i >= 0 ? i : day.hours.indexOf(day.bestHour));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIdx]);

  const hour = day.hours[selectedIdx];
  const swapKey = useSwapKey(`${dayIdx}-${selectedIdx}`);

  const [userLevel, setUserLevel] = useState("int");

  const hlyWrapRef = useRef(null);
  useEffect(() => {
    const el = hlyWrapRef.current?.querySelector(".hly-row.selected");
    if (el) el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  const [ago, setAgo] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setAgo((a) => a + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const verdict = coherentVerdict(hour);
  const [scoreOpen, setScoreOpen] = useState(false);

  const sibSentinelRef = useRef(null);
  const [sibStuck, setSibStuck] = useState(false);
  useEffect(() => {
    const el = sibSentinelRef.current;
    if (!el) return;
    const root = el.closest(".viewport");
    if (!root) return;
    function onScroll() {
      const rect = el.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      setSibStuck(rect.top <= rootRect.top);
    }
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Phone>
      <div className="wrap">
        <div className="hdr rise-1">
          <div className="brand-row"><span className="now-dot"/><span className="brand">should you surf?</span></div>
          <div className="hdr-actions">
            <button className="ibtn">?</button>
            <button className="ibtn lang"><span>AU</span><span className="on">EN</span></button>
            <button className="ibtn fav">★</button>
          </div>
        </div>

        <div className="rise-1">
          <button className="spot-btn">
            <span className="spot-name">{spot.name}</span>
            <span className="spot-chev">▾</span>
          </button>
          <div className="spot-region">{spot.region} · {spot.type}</div>
        </div>

        <div className="rise-2">
          <div className="day-tabs">
            {days.map((d, i) => (
              <button
                key={i}
                onClick={() => setDayIdx(i)}
                className={`dt ${i === dayIdx ? "active" : ""} ${d.isPast ? "past" : ""}`}
              >
                <div className="dt-day">{d.label}</div>
                <div className="dt-date">{d.dateLabel}</div>
                <div className="dt-dot" style={{ background: d.bestLevel.color }}/>
              </button>
            ))}
          </div>
        </div>

        <div className="rise-2" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <button className="time-pill">
            <span className="dayw">{days[dayIdx].label}</span>
            <span className="hr">{fmtHour(hour.hour)}</span>
            <span style={{ color: "var(--text-dim)" }}>▾</span>
          </button>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
            UPDATED {ago}M AGO
          </span>
        </div>

        <VerdictHero verdict={verdict} hour={hour} swapKey={swapKey} onOpenScore={() => setScoreOpen(true)}/>

        {scoreOpen && <ScoreSheet hour={hour} verdict={verdict} onClose={() => setScoreOpen(false)}/>}

        <div className="lvl-inline rise-3">
          <button className="lvl-me-btn" onClick={() => {}}>Your level <span className="chev">▾</span></button>
          <div className="lvl-quick" role="tablist">
            {[["beg", "BEG"], ["eint", "E·INT"], ["int", "INT"], ["adv", "ADV"], ["exp", "EXP"]].map(([k, lbl]) => (
              <button key={k} className={userLevel === k ? "on" : ""} onClick={() => setUserLevel(k)}>{lbl}</button>
            ))}
          </div>
        </div>

        <div ref={sibSentinelRef} aria-hidden="true" style={{ height: 1, margin: "16px 0 -17px" }}/>

        <StickyInfoBar
          hour={hour}
          swapKey={swapKey}
          reasonText={verdict.sub}
          sentinelRef={null}
          stuck={sibStuck}
          userLevel={userLevel}
        />

        <DrivingChips hour={hour}/>

        <BestWindow day={day}/>

        <div ref={hlyWrapRef}>
          <HourlyList hours={day.hours} selectedIdx={selectedIdx} onSelect={setSelectedIdx} currentHour={currentHour}/>
        </div>

        <TideCurve hours={day.hours} selectedIdx={selectedIdx} onSelect={setSelectedIdx}/>

        <LevelMatrix hour={hour}/>

        <Footer/>
      </div>
    </Phone>
  );
}
