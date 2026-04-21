"use client";

// v2 MainScreen — full-feature port.
// Visual = claude-design v2 (warm paper + 5 themes + phone frame + sticky bar).
// Logic = v1 prod (real scoring, 6 levels, BreakPicker worldwide, GPS, map picker,
//         12 languages, FAQ, onboarding, favourites, notifications, PWA install,
//         share-URL params, service worker).

import { useEffect, useMemo, useRef, useState } from "react";
import { BREAKS, findBreak } from "../../breaks";
import { getT } from "../../i18n";
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
import ThemeSwitcher from "./ThemeSwitcher";
import BreakPicker from "./BreakPicker";
import LevelPicker from "./LevelPicker";
import LangPicker from "./LangPicker";
import CustomLangModal from "./CustomLangModal";
import FaqSheet from "./FaqSheet";
import OnboardingModal from "./OnboardingModal";
import PwaInstallPrompt from "./PwaInstallPrompt";
import { useSwapKey, fmtHour } from "../lib/hooks";
import { coherentVerdict } from "../lib/verdict";
import { makeForecast } from "../lib/mock";
import { fetchRealForecast } from "../lib/realFetch";
import {
  getPersonalAdviceKey,
  getPersonalModifier,
  getTideModifier,
  fmtLongDay,
} from "../lib/prodScoring";

const DEFAULT_SPOT = BREAKS.find((b) => b.id === "trigg") || BREAKS[0];

export default function MainScreen({ theme, setTheme }) {
  const [spot, setSpot] = useState(DEFAULT_SPOT);
  const [payload, setPayload] = useState(null); // { days, sunByDay, effectiveSpot }
  const [dataSource, setDataSource] = useState("loading");
  const [fetchError, setFetchError] = useState(null);

  // UI state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showAddLang, setShowAddLang] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showPwa, setShowPwa] = useState(false);

  // Persisted preferences
  const [userLevel, setUserLevel] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [lang, setLang] = useState("en");
  const [customLangs, setCustomLangs] = useState([]);
  const [country, setCountry] = useState("AU");
  const [notifOptIn, setNotifOptIn] = useState(false);

  const customLangDict = customLangs.find((c) => c.code === lang)?.translations;
  const t = getT(lang, customLangDict);

  // Load persisted state + shared-URL params
  useEffect(() => {
    try {
      const savedId = localStorage.getItem("surf-last-break");
      const savedCustom = localStorage.getItem("surf-last-break-custom");
      if (savedCustom) setSpot(JSON.parse(savedCustom));
      else if (savedId) setSpot(findBreak(savedId));
      const favs = localStorage.getItem("surf-favorites");
      if (favs) setFavorites(JSON.parse(favs));
      const savedLang = localStorage.getItem("surf-lang");
      if (savedLang) setLang(savedLang);
      const savedCustomLangs = localStorage.getItem("surf-custom-langs");
      if (savedCustomLangs) setCustomLangs(JSON.parse(savedCustomLangs));
      const savedLvl = localStorage.getItem("surf-user-level");
      if (savedLvl) setUserLevel(savedLvl);
      const onboarded = localStorage.getItem("surf-onboarded-v2");
      if (!onboarded && !savedLvl) setOnboardingOpen(true);
      const savedCountry = localStorage.getItem("surf-country");
      if (savedCountry) setCountry(savedCountry);
      const notifOpt = localStorage.getItem("surf-notif-opt-in");
      if (notifOpt && typeof Notification !== "undefined" && Notification.permission === "granted") {
        setNotifOptIn(true);
      }
      const params = new URLSearchParams(window.location.search);
      const sharedSpot = params.get("spot");
      if (sharedSpot) {
        const b = findBreak(sharedSpot);
        if (b) setSpot(b);
      }
    } catch {}
  }, []);

  // Service worker registration
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // PWA install banner (mobile, non-standalone, not previously dismissed)
  useEffect(() => {
    const isStandalone = typeof window !== "undefined" &&
      (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches);
    if (isStandalone) return;
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent || "");
    if (!isMobile) return;
    try { if (localStorage.getItem("surf-pwa-shown")) return; } catch {}
    setShowPwa(true);
  }, []);

  // Persist spot + favourites
  useEffect(() => {
    try {
      if (spot.id.startsWith("custom-")) {
        localStorage.setItem("surf-last-break-custom", JSON.stringify(spot));
        localStorage.removeItem("surf-last-break");
      } else {
        localStorage.setItem("surf-last-break", spot.id);
        localStorage.removeItem("surf-last-break-custom");
      }
    } catch {}
  }, [spot]);
  useEffect(() => {
    try { localStorage.setItem("surf-favorites", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  function saveUserLevel(lvl) {
    setUserLevel(lvl);
    try {
      if (lvl) localStorage.setItem("surf-user-level", lvl);
      else localStorage.removeItem("surf-user-level");
    } catch {}
  }
  function finishOnboarding(lvl) {
    if (lvl) saveUserLevel(lvl);
    setOnboardingOpen(false);
    try { localStorage.setItem("surf-onboarded-v2", "1"); } catch {}
  }
  function toggleFav(id) {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }
  function saveCountry(code) {
    setCountry(code);
    try { localStorage.setItem("surf-country", code); } catch {}
  }
  function saveCustomLang(cl) {
    setCustomLangs((prev) => {
      const next = prev.filter((c) => c.code !== cl.code).concat(cl);
      try { localStorage.setItem("surf-custom-langs", JSON.stringify(next)); } catch {}
      return next;
    });
    setLang(cl.code);
    try { localStorage.setItem("surf-lang", cl.code); } catch {}
    setShowAddLang(false);
  }
  function deleteCustomLang(code) {
    setCustomLangs((prev) => {
      const next = prev.filter((c) => c.code !== code);
      try { localStorage.setItem("surf-custom-langs", JSON.stringify(next)); } catch {}
      return next;
    });
    if (lang === code) setLang("en");
  }
  function dismissPwa() {
    setShowPwa(false);
    try { localStorage.setItem("surf-pwa-shown", "1"); } catch {}
  }

  // Fetch forecast whenever the spot changes
  useEffect(() => {
    let cancelled = false;
    setDataSource("loading");
    setPayload(null);
    (async () => {
      try {
        const real = await fetchRealForecast(spot);
        if (cancelled) return;
        if (real && real.days && real.days.length) {
          setPayload(real);
          setDataSource("live");
          return;
        }
        throw new Error("Empty forecast");
      } catch (e) {
        if (cancelled) return;
        console.warn("[v2] real forecast failed, using mock:", e);
        const mockDays = makeForecast(spot.id);
        setPayload({ days: mockDays, sunByDay: {}, effectiveSpot: spot });
        setDataSource("mock");
        setFetchError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [spot]);

  async function toggleNotifications() {
    if (typeof Notification === "undefined") { alert(t("notif_unsupported")); return; }
    if (notifOptIn) {
      try { localStorage.removeItem("surf-notif-opt-in"); } catch {}
      setNotifOptIn(false);
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") { alert(t("notif_denied")); return; }
    try { localStorage.setItem("surf-notif-opt-in", "1"); } catch {}
    setNotifOptIn(true);
    if (!payload) return;
    const now = Date.now();
    let best = null;
    for (const d of payload.days) {
      if (d.isPast) continue;
      for (const h of d.hours) {
        if (new Date(h.time).getTime() < now) continue;
        if (h.score >= 65 && (!best || h.score > best.score)) best = h;
      }
    }
    if (best) {
      const when = `${fmtLongDay(best.time.split("T")[0], spot.timezone || "Australia/Perth", t)} ${fmtHour(best.hour)}`;
      new Notification(`🌊 ${spot.name}`, { body: `${t("notif_best_window")}: ${when} · ${best.score}/100`, icon: "/icon-192.png" });
    } else {
      new Notification(`${spot.name}`, { body: t("notif_none_upcoming"), icon: "/icon-192.png" });
    }
  }

  if (!payload) {
    return (
      <Phone>
        <div className="wrap" style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-mu)", fontStyle: "italic" }}>
          {t("loading") || "Reading the ocean…"}
        </div>
      </Phone>
    );
  }

  return (
    <>
      <Loaded
        spot={spot}
        payload={payload}
        dataSource={dataSource}
        fetchError={fetchError}
        theme={theme}
        setTheme={setTheme}
        t={t}
        lang={lang}
        userLevel={userLevel}
        setUserLevel={saveUserLevel}
        favorites={favorites}
        toggleFav={toggleFav}
        notifOptIn={notifOptIn}
        toggleNotifications={toggleNotifications}
        onOpenPicker={() => setPickerOpen(true)}
        onOpenLevel={() => setLevelPickerOpen(true)}
        onOpenLang={() => setLangOpen(true)}
        onOpenFaq={() => setFaqOpen(true)}
      />
      {pickerOpen && (
        <BreakPicker
          onSelect={(b) => { setSpot(b); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
          favorites={favorites}
          toggleFav={toggleFav}
          currentId={spot.id}
          t={t}
          country={country}
          setCountry={saveCountry}
        />
      )}
      {levelPickerOpen && (
        <LevelPicker userLevel={userLevel} onPick={saveUserLevel} onClose={() => setLevelPickerOpen(false)} t={t}/>
      )}
      {langOpen && (
        <LangPicker
          lang={lang}
          setLang={setLang}
          onClose={() => setLangOpen(false)}
          customLangs={customLangs}
          onDeleteCustom={deleteCustomLang}
          onAddLang={() => setShowAddLang(true)}
        />
      )}
      {showAddLang && <CustomLangModal onSave={saveCustomLang} onClose={() => setShowAddLang(false)}/>}
      {faqOpen && <FaqSheet onClose={() => setFaqOpen(false)} t={t}/>}
      {onboardingOpen && <OnboardingModal onPick={finishOnboarding} onSkip={() => finishOnboarding(null)} t={t}/>}
      {showPwa && <PwaInstallPrompt onDismiss={dismissPwa} t={t}/>}
    </>
  );
}

function Loaded({
  spot, payload, dataSource, fetchError,
  theme, setTheme, t, lang,
  userLevel, setUserLevel,
  favorites, toggleFav,
  notifOptIn, toggleNotifications,
  onOpenPicker, onOpenLevel, onOpenLang, onOpenFaq,
}) {
  const days = payload.days;
  const effectiveSpot = payload.effectiveSpot || spot;
  const todayIdxInit = days.findIndex((d) => d.isToday);
  const [dayIdx, setDayIdx] = useState(todayIdxInit >= 0 ? todayIdxInit : 0);
  const day = days[dayIdx];

  const currentHour = (() => {
    const h = new Date().getHours();
    const min = day.hours[0].hour;
    const max = day.hours[day.hours.length - 1].hour;
    return Math.min(max, Math.max(min, h));
  })();

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

  const hlyWrapRef = useRef(null);
  useEffect(() => {
    const el = hlyWrapRef.current?.querySelector(".hly-row.selected");
    if (el) el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  const [ago, setAgo] = useState(0);
  useEffect(() => {
    const tick = setInterval(() => setAgo((a) => a + 1), 60000);
    return () => clearInterval(tick);
  }, []);

  const verdict = coherentVerdict(hour);
  const [scoreOpen, setScoreOpen] = useState(false);

  // Personal advice: if the user picked a level we build a sentence from the
  // prod i18n keys and show it as the sticky-bar reason text. Fallback to the
  // verdict.sub when no level picked or when an i18n key is missing.
  const personalReason = useMemo(() => {
    if (!userLevel) return verdict.sub;
    // prodScoring functions want swellDir/windDir in DEGREES — the shaped
    // hour carries them as cardinal strings for display, so rebuild the raw
    // view from the *Deg fields before calling them.
    const hourDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
    const adviceKey = getPersonalAdviceKey(userLevel, hourDeg, effectiveSpot);
    const modifierKey = getPersonalModifier(userLevel, hourDeg, effectiveSpot);
    const tideModKey = getTideModifier(hour, day.hours);
    const main = t(adviceKey);
    if (!main || main === adviceKey || main.startsWith("tip_")) return verdict.sub;
    const parts = [main];
    if (modifierKey) { const m = t(modifierKey); if (m && m !== modifierKey) parts.push(m); }
    if (tideModKey)  { const m = t(tideModKey);  if (m && m !== tideModKey)  parts.push(m); }
    return parts.filter(Boolean).join(" · ");
  }, [userLevel, hour, effectiveSpot, day.hours, t, verdict.sub]);

  const sibSentinelRef = useRef(null);
  const [sibStuck, setSibStuck] = useState(false);
  useEffect(() => {
    const el = sibSentinelRef.current;
    if (!el) return;
    const root = el.closest(".viewport");
    if (!root) return;
    // IntersectionObserver is smoother than a scroll handler — it fires once
    // per crossing (not every pixel of scroll) and doesn't flicker when the
    // bar's size changes. isIntersecting=false = sentinel is above the top
    // edge = bar is stuck.
    const io = new IntersectionObserver(
      ([entry]) => setSibStuck(!entry.isIntersecting),
      { root, rootMargin: "0px 0px -100% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isFav = favorites.includes(spot.id);
  const [userLevelQuick, setUserLevelQuick] = useState(() => userLevel || "int");
  useEffect(() => { if (userLevel) setUserLevelQuick(userLevel); }, [userLevel]);

  async function shareSpot() {
    const url = `${window.location.origin}/v2?spot=${encodeURIComponent(spot.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.name, text: `${t("brand") || "should you surf?"} — ${spot.name}`, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert(t("share_copied") || "Link copied");
      }
    } catch {}
  }

  return (
    <Phone>
      <div className="wrap">
        <div className="hdr rise-1">
          <div className="brand-row"><span className="now-dot"/><span className="brand">{t("brand") || "should you surf?"}</span></div>
          <div className="hdr-actions">
            <button className="ibtn" onClick={onOpenFaq} title={t("faq_title")}>?</button>
            <button className="ibtn lang" onClick={onOpenLang} title="Language">
              <span>{(lang || "en").toUpperCase()}</span>
            </button>
            <button
              className={`v2-fav-btn ${isFav ? "active" : ""}`}
              onClick={() => toggleFav(spot.id)}
              title={isFav ? "Remove from favourites" : "Save to favourites"}
            >{isFav ? "★" : "☆"}</button>
            <ThemeSwitcher theme={theme} setTheme={setTheme}/>
          </div>
        </div>

        <div className="rise-1">
          <button className="spot-btn" onClick={onOpenPicker} title={t("choose_break")}>
            <span className="spot-name">{spot.name}</span>
            <span className="spot-chev">▾</span>
          </button>
          <div className="spot-region">
            {spot.region} · {t(spot.type || "beach")}
            {dataSource === "mock" && (
              <span style={{ marginLeft: 8, color: "var(--coral)", fontStyle: "italic", letterSpacing: 0 }}>
                · live data unavailable · showing mock
              </span>
            )}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className={`v2-hdr-chip ${notifOptIn ? "on" : ""}`}
              onClick={toggleNotifications}
              title={notifOptIn ? t("notif_on") : t("notif_off")}
            >
              {notifOptIn ? "🔔" : "🔕"} <span>{notifOptIn ? (t("notif_on") || "notifications on") : (t("notif_off") || "notifications off")}</span>
            </button>
            <button className="v2-hdr-chip" onClick={shareSpot}>🔗 <span>{t("share") || "share"}</span></button>
          </div>
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
          <button className="lvl-me-btn" onClick={onOpenLevel}>
            {userLevel ? (t("lvl_" + userLevel) || userLevel) : (t("pick_level") || "Your level")} <span className="chev">▾</span>
          </button>
          <div className="lvl-quick" role="tablist">
            {[["beg", "BEG"], ["eint", "E·INT"], ["int", "INT"], ["adv", "ADV"], ["exp", "EXP"]].map(([k, lbl]) => (
              <button key={k} className={userLevelQuick === k ? "on" : ""} onClick={() => setUserLevelQuick(k)}>{lbl}</button>
            ))}
          </div>
        </div>

        <div ref={sibSentinelRef} aria-hidden="true" style={{ height: 1, margin: "16px 0 -17px" }}/>

        <StickyInfoBar
          hour={hour}
          swapKey={swapKey}
          reasonText={personalReason}
          sentinelRef={null}
          stuck={sibStuck}
          userLevel={userLevel || userLevelQuick}
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
