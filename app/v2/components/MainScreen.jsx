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
import DangerBanner from "./DangerBanner";
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
  getPersonalVerdict,
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

  // Fetch forecast whenever the spot changes.
  // Strategy: show mock data IMMEDIATELY so the UI is never stuck on the
  // loading splash, then upgrade to real data when it arrives. If the real
  // fetch takes more than 8s we just stay on mock (with the "live data
  // unavailable" badge). This keeps the preview interactive even if the
  // user's network blocks Open-Meteo.
  useEffect(() => {
    let cancelled = false;
    // Seed with mock right away — no loading screen deadlock.
    const mockDays = makeForecast(spot.id);
    setPayload({ days: mockDays, sunByDay: {}, effectiveSpot: spot });
    setDataSource("mock");
    setFetchError(null);

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Fetch timed out after 8s")), 8000),
    );
    (async () => {
      try {
        const real = await Promise.race([fetchRealForecast(spot), timeout]);
        if (cancelled) return;
        if (real && real.days && real.days.length) {
          setPayload(real);
          setDataSource("live");
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("[v2] real forecast failed, staying on mock:", e);
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
        <div className="v2-loading">
          <div className="v2-loading-brand serif">{t("brand") || "should you surf?"}</div>
          <svg className="v2-loading-wave" viewBox="0 0 180 40" preserveAspectRatio="none">
            <path d="M0,20 Q22.5,5 45,20 T90,20 T135,20 T180,20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <animate attributeName="d" dur="3.2s" repeatCount="indefinite"
                values="M0,20 Q22.5,5 45,20 T90,20 T135,20 T180,20;
                        M0,20 Q22.5,35 45,20 T90,20 T135,20 T180,20;
                        M0,20 Q22.5,5 45,20 T90,20 T135,20 T180,20"/>
            </path>
            <path d="M0,28 Q22.5,18 45,28 T90,28 T135,28 T180,28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45">
              <animate attributeName="d" dur="4.4s" repeatCount="indefinite"
                values="M0,28 Q22.5,38 45,28 T90,28 T135,28 T180,28;
                        M0,28 Q22.5,18 45,28 T90,28 T135,28 T180,28;
                        M0,28 Q22.5,38 45,28 T90,28 T135,28 T180,28"/>
            </path>
          </svg>
          <div className="v2-loading-dots">
            <span/><span/><span/>
          </div>
          <div className="v2-loading-text mono">{t("loading") || "Reading the ocean…"}</div>
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

  // Quick-picker state lives HERE so `effectiveLevel` can reference it
  // below without a forward-reference ReferenceError.
  const [userLevelQuick, setUserLevelQuick] = useState(() => userLevel || "int");
  useEffect(() => { if (userLevel) setUserLevelQuick(userLevel); }, [userLevel]);

  // Personal advice: if the user picked a level we build a sentence from the
  // prod i18n keys and show it as the sticky-bar reason text. Map the quick-
  // picker 3-letter code to a full prod level so the advice system always
  // has a level to work with, even before the user opens the level sheet.
  const QUICK_TO_FULL = { beg: "beginner", eint: "early_int", int: "intermediate", adv: "advanced", exp: "expert" };
  const effectiveLevel = userLevel || QUICK_TO_FULL[userLevelQuick] || "intermediate";

  // Build the sticky-bar reason as a React node so we can highlight the
  // level name (bold) and the verdict label (coloured) inline — exactly like
  // the v1 production sticky-tip. Below the main line we append the
  // modifier (long period, off-angle, glassy, …) and the tide modifier
  // (tide soon to turn, rising, falling) when they apply.
  const personalReason = useMemo(() => {
    // prodScoring functions want swellDir/windDir in DEGREES — the shaped
    // hour carries them as cardinal strings for display, so rebuild the raw
    // view from the *Deg fields before calling them.
    const hourDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
    const adviceKey = getPersonalAdviceKey(effectiveLevel, hourDeg, effectiveSpot);
    const modifierKey = getPersonalModifier(effectiveLevel, hourDeg, effectiveSpot);
    const tideModKey = getTideModifier(hour, day.hours);
    const pv = getPersonalVerdict(effectiveLevel, hourDeg, effectiveSpot);
    const tipRaw = t(adviceKey);
    const tipText = (!tipRaw || tipRaw === adviceKey || tipRaw.startsWith("tip_")) ? verdict.sub : tipRaw;
    const levelLabel = t("lvl_" + effectiveLevel) || effectiveLevel;
    const verdictLabel = pv === "yes" ? (t("go") || "GO") : pv === "ok" ? (t("maybe") || "MAYBE") : (t("skip") || "SKIP");
    const verdictColor = pv === "yes" ? "#16a34a" : pv === "ok" ? "#ea580c" : "#dc2626";
    const modifier = modifierKey ? t(modifierKey) : null;
    const tideMod = tideModKey ? t(tideModKey) : null;
    const isValid = (s, k) => s && s !== k && !s.startsWith("tip_");
    return (
      <>
        <strong>{levelLabel}</strong>
        {" "}<span style={{ color: verdictColor, fontWeight: 600 }}>· {verdictLabel}</span>
        {" — "}{tipText}
        {isValid(modifier, modifierKey) && <span className="C-reason-mod">{modifier}</span>}
        {isValid(tideMod,  tideModKey)  && <span className="C-reason-mod">{tideMod}</span>}
      </>
    );
  }, [effectiveLevel, hour, effectiveSpot, day.hours, t, verdict.sub]);

  // Compact danger info — shown only to learners (first_timer / beginner /
  // early_int) when the per-level verdict is SKIP ("no"). Message is a
  // short always-visible line; detail expands on tap.
  const danger = useMemo(() => {
    const hourDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
    const pv = getPersonalVerdict(effectiveLevel, hourDeg, effectiveSpot);
    const isLearner = effectiveLevel === "first_timer" || effectiveLevel === "beginner" || effectiveLevel === "early_int";
    if (!(isLearner && pv === "no")) return null;
    const adviceKey = getPersonalAdviceKey(effectiveLevel, hourDeg, effectiveSpot);
    const raw = t(adviceKey);
    const tip = (!raw || raw === adviceKey || raw.startsWith("tip_")) ? verdict.sub : raw;
    return {
      message: t("danger_banner_short") || "Dangerous for your level",
      detail: tip,
    };
  }, [effectiveLevel, hour, effectiveSpot, t, verdict.sub]);

  const sibSentinelRef = useRef(null);
  const [sibStuck, setSibStuck] = useState(false);

  // Sticky day nav — compact floating bar that mirrors .day-tabs and
  // appears at top:50px (under the status bar) once the user has scrolled
  // past the regular day-tabs row. Absolute-positioned inside .viewport
  // with its `top` updated via scroll listener.
  const dayTabsRef = useRef(null);
  const [dayNavTop, setDayNavTop] = useState(50);
  const [dayNavVisible, setDayNavVisible] = useState(false);
  useEffect(() => {
    const root = dayTabsRef.current?.closest(".viewport");
    if (!root || !dayTabsRef.current) return;
    const el = dayTabsRef.current;
    const onScroll = () => {
      const st = root.scrollTop;
      setDayNavTop(st + 50);
      const threshold = el.offsetTop + el.offsetHeight;
      setDayNavVisible(st > threshold);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = sibSentinelRef.current;
    if (!el) return;
    const root = el.closest(".viewport");
    if (!root) return;
    const bar = root.querySelector(".C"); // the sticky bar itself
    const rect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const threshold = Math.max(0, rect.top - rootRect.top + root.scrollTop - 1);
    const BUFFER = 100;        // hysteresis: scroll up 100px to un-stick
    const LATCH_MS = 500;      // after toggle, ignore scroll for 500ms
    let ticking = false;
    let stuck = false;
    let lastToggle = 0;
    let suppressScroll = false; // skip onScroll events we trigger ourselves

    // On toggle, compensate scrollTop by the bar's height delta so the
    // content doesn't visually "jump" — the user's eye doesn't over-correct,
    // so the threshold isn't accidentally re-crossed. This kills the 2-3
    // rebound cycles at slow scroll.
    const compensate = (beforeH) => {
      requestAnimationFrame(() => {
        if (!bar) return;
        const afterH = bar.getBoundingClientRect().height;
        const delta = beforeH - afterH;
        if (Math.abs(delta) > 1) {
          suppressScroll = true;
          root.scrollTop -= delta;      // bar got smaller → scroll up to keep content anchored
          requestAnimationFrame(() => { suppressScroll = false; });
        }
      });
    };

    const onScroll = () => {
      if (suppressScroll) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (Date.now() - lastToggle < LATCH_MS) return;
        const s = root.scrollTop;
        if (!stuck && s >= threshold) {
          const beforeH = bar ? bar.getBoundingClientRect().height : 0;
          stuck = true; lastToggle = Date.now(); setSibStuck(true);
          compensate(beforeH);
        } else if (stuck && s < threshold - BUFFER) {
          const beforeH = bar ? bar.getBoundingClientRect().height : 0;
          stuck = false; lastToggle = Date.now(); setSibStuck(false);
          compensate(beforeH);
        }
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const isFav = favorites.includes(spot.id);

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
            {/* Notification toggle — icon-only, sits before the ? */}
            <button
              className={`ibtn notif ${notifOptIn ? "on" : ""}`}
              onClick={toggleNotifications}
              title={notifOptIn ? (t("notif_on") || "Notifications on") : (t("notif_off") || "Notifications off")}
              aria-label="Toggle notifications"
            >
              {notifOptIn ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
              )}
            </button>
            <button className="ibtn" onClick={onOpenFaq} title={t("faq_title")}>?</button>
            <button className="ibtn lang" onClick={onOpenLang} title="Language">
              <span>{(lang || "en").toUpperCase()}</span>
            </button>
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
        </div>

        <div className="rise-2">
          <div className="day-tabs" ref={dayTabsRef}>
            {days.map((d, i) => (
              <button
                key={i}
                onClick={(e) => {
                  setDayIdx(i);
                  // v1 behavior: smoothly scroll the clicked tab toward the
                  // centre of the tab bar so the neighbouring days become
                  // visible — same as app/page.js handleTabClick().
                  e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                className={`dt ${i === dayIdx ? "active" : ""} ${d.isPast ? "past" : ""}`}
              >
                <div className="dt-day">{d.label}</div>
                <div className="dt-date">{d.dateLabel}</div>
                <div className="dt-dot" style={{ background: d.bestLevel.color }}/>
              </button>
            ))}
          </div>
        </div>

        {/* Sticky compact day-nav — appears docked under the status bar
            once the user scrolls past the regular .day-tabs row. */}
        <div
          className={`sticky-day-nav ${dayNavVisible ? "visible" : ""}`}
          style={{ top: dayNavTop }}
          aria-hidden={!dayNavVisible}
        >
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

        {/* Sentinel — its captured offsetTop is the "lock" threshold. Sits
            directly above the bar in normal flow. scrollTop ≥ threshold ⇒ stuck. */}
        <div ref={sibSentinelRef} aria-hidden="true" style={{ height: 1, pointerEvents: "none" }}/>

        {danger && <DangerBanner message={danger.message} detail={danger.detail}/>}

        <StickyInfoBar
          hour={hour}
          swapKey={swapKey}
          reasonText={personalReason}
          stuck={sibStuck}
          dayHours={day.hours}
          allHours={payload.days.flatMap((d) => d.hours)}
          sunByDay={payload.sunByDay}
          tz={spot.timezone || "Australia/Perth"}
          t={t}
          effectiveSpot={effectiveSpot}
        />

        <DrivingChips hour={hour}/>

        <BestWindow day={day}/>

        <div ref={hlyWrapRef}>
          <HourlyList
            hours={day.hours}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            currentHour={currentHour}
            sunByDay={payload.sunByDay}
            tz={spot.timezone || "Australia/Perth"}
            reasonText={personalReason}
          />
        </div>

        <TideCurve hours={day.hours} selectedIdx={selectedIdx} onSelect={setSelectedIdx}/>

        <LevelMatrix hour={hour}/>

        <Footer/>
      </div>
    </Phone>
  );
}
