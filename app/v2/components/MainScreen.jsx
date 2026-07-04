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
import LoadingScreen from "./LoadingScreen";
import { useSwapKey, fmtHour } from "../lib/hooks";
import { track } from "../../lib/analytics";
import { startVersionCheck } from "../../lib/versionCheck";
import { coherentVerdict } from "../lib/verdict";
import { makeForecast } from "../lib/mock";
import { fetchRealForecast, readCachedPayload, writeCachedPayload } from "../lib/realFetch";
import {
  classifyConditions,
  getPersonalAdviceKey,
  getPersonalModifier,
  getPersonalVerdict,
  getTideModifier,
  fmtLongDay,
  adaptForecastToLevel,
  getBoardRec,
  getSessionNotes,
  faceFtOf,
  dayTideCtx,
} from "../lib/prodScoring";

const DEFAULT_SPOT = BREAKS.find((b) => b.id === "trigg") || BREAKS[0];

// Page-scope `new Notification()` throws on Android Chrome and is a no-op
// on iOS PWAs — notifications must go through the service worker
// registration there. Try the SW path first, constructor as fallback.
async function showLocalNotification(title, opts) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) { await reg.showNotification(title, opts); return; }
  } catch {}
  try { new Notification(title, opts); } catch {}
}

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

  // Analytics guards: spotEffectRanRef distinguishes mount from user action,
  // restoredSpotRef marks setSpot calls that come from localStorage / URL
  // restoration (they re-run the [spot] effect but are not user picks).
  const spotEffectRanRef = useRef(false);
  const restoredSpotRef = useRef(false);

  // PWA install event — fires when user accepts the install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = () => track("pwa_installed");
    window.addEventListener("appinstalled", h);
    return () => window.removeEventListener("appinstalled", h);
  }, []);

  // Poll /version.json so a deploy reaches cached iOS PWAs within ~1 min
  // — no "please reinstall the app" message ever needed.
  useEffect(() => { startVersionCheck(); }, []);

  // Lang change tracking — skip initial mount, only fire on user action
  const prevLangRef = useRef(null);
  useEffect(() => {
    if (prevLangRef.current !== null && prevLangRef.current !== lang) {
      track("language_changed", { from: prevLangRef.current, to: lang });
    }
    prevLangRef.current = lang;
  }, [lang]);

  // Load persisted state + shared-URL params. Each read is individually
  // guarded: with the old single try/catch, ONE corrupt JSON key (e.g.
  // favourites) silently aborted every restoration after it — language,
  // level, country AND the shared ?spot= link all reset to defaults.
  useEffect(() => {
    const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
    const safeJson = (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } };

    const savedCustom = safeJson("surf-last-break-custom");
    // Minimal shape validation — a malformed custom spot (string lat…)
    // would otherwise go straight into the Open-Meteo URL.
    if (savedCustom && typeof savedCustom.id === "string"
        && Number.isFinite(savedCustom.lat) && Number.isFinite(savedCustom.lng)) {
      restoredSpotRef.current = true;
      setSpot(savedCustom);
    } else {
      const savedId = safeGet("surf-last-break");
      if (savedId) { restoredSpotRef.current = true; setSpot(findBreak(savedId)); }
    }
    const favs = safeJson("surf-favorites");
    if (Array.isArray(favs)) setFavorites(favs.filter((x) => typeof x === "string"));
    const savedLang = safeGet("surf-lang");
    if (savedLang) setLang(savedLang);
    const savedCustomLangs = safeJson("surf-custom-langs");
    if (Array.isArray(savedCustomLangs)) setCustomLangs(savedCustomLangs);
    const savedLvl = safeGet("surf-user-level");
    if (savedLvl) setUserLevel(savedLvl);
    const onboarded = safeGet("surf-onboarded-v2");
    if (!onboarded && !savedLvl) setOnboardingOpen(true);
    const savedCountry = safeGet("surf-country");
    if (savedCountry) setCountry(savedCountry);
    const notifOpt = safeGet("surf-notif-opt-in");
    if (notifOpt && typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifOptIn(true);
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedSpot = params.get("spot");
      if (sharedSpot) {
        const b = findBreak(sharedSpot);
        if (b) { restoredSpotRef.current = true; setSpot(b); }
      }
    } catch {}
  }, []);

  // Service worker registration
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // PWA install banner (mobile, non-standalone, not recently dismissed).
  // Re-shows 7 days after dismiss so a single accidental ✕ doesn't silence
  // it forever — until the user actually installs (then standalone = true
  // and we skip permanently). Storage key was renamed from the old hard
  // "surf-pwa-shown" boolean so existing users get one fresh prompt.
  useEffect(() => {
    const isStandalone = typeof window !== "undefined" &&
      (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches);
    if (isStandalone) return;
    const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent || "");
    if (!isMobile) return;
    try {
      const dismissedAt = parseInt(localStorage.getItem("surf-pwa-dismissed-at") || "0", 10);
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (dismissedAt && Date.now() - dismissedAt < SEVEN_DAYS) return;
    } catch {}
    // Slight delay so the page paints first, then the banner slides up —
    // catches the eye instead of being ignored as part of initial render.
    const timer = setTimeout(() => setShowPwa(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Persist spot + favourites + analytics. Analytics only fire on ACTUAL
  // spot changes — the effect also runs on mount (default/restored spot),
  // which used to inflate spot_selected by one per pageload and fire
  // custom_spot_added on every visit for users with a persisted custom spot.
  useEffect(() => {
    const isUserAction = spotEffectRanRef.current && !restoredSpotRef.current;
    spotEffectRanRef.current = true;
    restoredSpotRef.current = false;
    try {
      if (spot.id.startsWith("custom-")) {
        localStorage.setItem("surf-last-break-custom", JSON.stringify(spot));
        localStorage.removeItem("surf-last-break");
        if (isUserAction) track("custom_spot_added", { lat: spot.lat, lng: spot.lng });
      } else {
        localStorage.setItem("surf-last-break", spot.id);
        localStorage.removeItem("surf-last-break-custom");
      }
      if (isUserAction) track("spot_selected", { id: spot.id, name: spot.name, country: spot.country, type: spot.type });
    } catch {}
  }, [spot]);
  useEffect(() => {
    try { localStorage.setItem("surf-favorites", JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  function saveUserLevel(lvl) {
    setUserLevel(lvl);
    if (lvl) track("level_picked", { level: lvl });
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
    setFavorites((f) => {
      const has = f.includes(id);
      track(has ? "favorite_removed" : "favorite_added", { spotId: id });
      return has ? f.filter((x) => x !== id) : [...f, id];
    });
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
    try { localStorage.setItem("surf-pwa-dismissed-at", String(Date.now())); } catch {}
  }

  // Minimum display time for the LoadingScreen so the splash actually
  // plays (video + wave animation + dots). Without this the mock data
  // seed below makes payload truthy within one frame and the user never
  // sees the splash.
  const [splashReady, setSplashReady] = useState(false);
  useEffect(() => {
    // 1.2s floor (was 2.5s): long enough for the splash not to flash,
    // short enough not to tax every single visit's LCP — the app's whole
    // promise is a fast decision.
    const id = setTimeout(() => setSplashReady(true), 1200);
    return () => clearTimeout(id);
  }, []);

  // Fetch forecast whenever the spot changes — and refetch when the user
  // returns to the tab so the displayed data isn't stale.
  //
  // Strategy: show mock data IMMEDIATELY so the UI is never stuck on the
  // loading splash, then upgrade to real data when it arrives. If the real
  // fetch takes more than 8s we just stay on mock (with the "live data
  // unavailable" badge). This keeps the preview interactive even if the
  // user's network blocks Open-Meteo.
  const [lastFetchAt, setLastFetchAt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    // Seed : le DERNIER forecast live de ce spot (cache localStorage,
    // re-étiqueté par date) s'affiche instantanément — pas de mock, pas de
    // bannière, pas d'attente. Le fetch frais le remplace en silence.
    const cached = readCachedPayload(spot.id);
    if (cached) {
      setPayload(cached.payload);
      setDataSource("cached");
      setLastFetchAt(cached.cachedAt);
      // De vraies données sont à l'écran → le splash peut tomber tout de suite.
      if (typeof window !== "undefined") window.__appReady = true;
    } else {
      // Pas de cache (première visite / nouveau spot) : seed mock en source
      // "loading" — AUCUNE bannière rouge pendant que le fetch tourne, et
      // __appReady n'est posé qu'au settle du fetch (finally ci-dessous) :
      // le splash vidéo couvre l'écran jusqu'aux vraies données, comme
      // avant. Sans ça, l'utilisateur voyait 3-5s de scores mock + bannière
      // "live forecast unavailable" à CHAQUE lancement et croyait l'app
      // cassée. Le kill-switch layout.js est à 20s > timeout 15s : il ne
      // peut pas se déclencher sur un fetch légitimement lent.
      const mockDays = makeForecast(spot.id);
      setPayload({ days: mockDays, sunByDay: {}, effectiveSpot: spot });
      setDataSource("loading");
    }
    setFetchError(null);

    // Open-Meteo's marine API can be slow (its two marine calls dominate the
    // 4-request fan-out). 15s timeout via AbortController so the four
    // requests are actually cancelled.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Fetch timed out after 15s")), 15000);
    (async () => {
      try {
        const real = await fetchRealForecast(spot, controller.signal);
        if (cancelled) return;
        if (real && real.days && real.days.length) {
          setPayload(real);
          setDataSource("live");
          setLastFetchAt(Date.now());
          writeCachedPayload(spot.id, real);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e?.message || String(e);
        console.warn("[v2] real forecast failed:", e);
        setFetchError(msg);
        // Échec : on reste sur le cache (bannière douce "cached") si on en
        // avait un, sinon sur le mock (bannière rouge "sample data").
        setDataSource(cached ? "cached-stale" : "mock");
        track("forecast_fetch_failed", { error: msg, spotId: spot.id });
      } finally {
        clearTimeout(timer);
        if (typeof window !== "undefined") window.__appReady = true;
      }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [spot]);

  // Refetch when the tab regains focus AND it's been > 5 minutes since the
  // last successful real fetch. Without this the user could leave the app
  // open in the morning, paddle out, come back at lunch and still see the
  // 7am scores. The "UPDATED Xm ago" badge resets to 0 on a successful
  // refetch.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const STALE_MS = 5 * 60 * 1000;
    // `cancelled` guards the async landing: without it, a refetch for spot A
    // started on tab-return could resolve AFTER the user switched to spot B
    // and overwrite B's payload with A's swell (race observed in audit).
    let cancelled = false;
    const controller = new AbortController();
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchAt < STALE_MS) return;
      // Même timeout 15s que le fetch initial — un refetch silencieux ne
      // doit pas pendre indéfiniment si Open-Meteo est lent. Pas de retry
      // ici : on garde simplement les données déjà affichées si ça échoue.
      const timer = setTimeout(() => controller.abort(new Error("refetch timed out after 15s")), 15000);
      try {
        const real = await fetchRealForecast(spot, controller.signal);
        if (cancelled) return;
        if (real && real.days && real.days.length) {
          setPayload(real);
          setDataSource("live");
          setFetchError(null);
          setLastFetchAt(Date.now());
          writeCachedPayload(spot.id, real);
        }
      } catch (e) {
        if (!cancelled) console.warn("[v2] visibility refetch failed:", e);
      } finally {
        clearTimeout(timer);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [spot, lastFetchAt]);

  async function toggleNotifications() {
    if (typeof Notification === "undefined") { alert(t("notif_unsupported")); return; }
    if (notifOptIn) {
      try { localStorage.removeItem("surf-notif-opt-in"); } catch {}
      setNotifOptIn(false);
      track("notif_opted_in", { state: false });
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") { alert(t("notif_denied")); return; }
    try { localStorage.setItem("surf-notif-opt-in", "1"); } catch {}
    setNotifOptIn(true);
    track("notif_opted_in", { state: true });
    if (!payload) return;
    // Notification "best window" doit utiliser les scores LEVEL-ADAPTÉS,
    // pas les scores baseline intermediate du payload raw. Sinon un user
    // early_int est notifié pour une heure scorée 67 baseline mais 38
    // adapted (verdict no → cap) pour son niveau (audit CONTRADICTION #2).
    const effectiveSpotForNotif = payload.effectiveSpot || spot;
    const effectiveLevel = userLevel || "intermediate";
    const adapted = adaptForecastToLevel(payload, effectiveLevel, effectiveSpotForNotif);
    const now = Date.now();
    let best = null;
    for (const d of adapted.days) {
      if (d.isPast) continue;
      for (const h of d.hours) {
        if (new Date(h.time).getTime() < now) continue;
        // 60 = borne basse de la bande "excellent" (SCORE_SCALE) — l'ancien
        // seuil 65 ne notifiait jamais les heures excellent 60-64.
        if (h.score >= 60 && (!best || h.score > best.score)) best = h;
      }
    }
    if (best) {
      const tz = payload?.effectiveSpot?.timezone || spot.timezone || "Australia/Perth";
      const when = `${fmtLongDay(best.time.split("T")[0], tz, t)} ${fmtHour(best.hour)}`;
      showLocalNotification(`🌊 ${spot.name}`, { body: `${t("notif_best_window")}: ${when} · ${best.score}/100`, icon: "/icon-192.png" });
    } else {
      showLocalNotification(`${spot.name}`, { body: t("notif_none_upcoming"), icon: "/icon-192.png" });
    }
  }

  if (!payload || !splashReady) {
    return <LoadingScreen tagline={t("loading") || "Reading the ocean…"}/>;
  }

  if (!payload.days || payload.days.length === 0) {
    return <LoadingScreen tagline={t("loading") || "Reading the ocean…"}/>;
  }

  return (
    <>
      <Loaded
        spot={spot}
        payload={payload}
        dataSource={dataSource}
        fetchError={fetchError}
        lastFetchAt={lastFetchAt}
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
        onOpenFaq={() => { track("faq_opened"); setFaqOpen(true); }}
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
          t={t}
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
  spot, payload: rawPayload, dataSource, fetchError, lastFetchAt,
  theme, setTheme, t, lang,
  userLevel, setUserLevel,
  favorites, toggleFav,
  notifOptIn, toggleNotifications,
  onOpenPicker, onOpenLevel, onOpenLang, onOpenFaq,
}) {
  const effectiveSpot = rawPayload.effectiveSpot || spot;

  // User level — comes from the sheet picker. Defaults to intermediate so the
  // per-level score adaptation always has a level to work with, even before
  // the user picks theirs.
  const effectiveLevel = userLevel || "intermediate";

  // Adapt forecast for the user's level — every hour.score and day.bestHour
  // now reflect "how good this would be FOR THIS USER". A 2m offshore day
  // reads 85 for an intermediate and 35 for a first-timer. The absolute
  // LevelMatrix row at the bottom still shows all 4 levels' verdicts so
  // users see how their day ranks relative to others.
  const payload = useMemo(
    () => adaptForecastToLevel(rawPayload, effectiveLevel, effectiveSpot),
    [rawPayload, effectiveLevel, effectiveSpot],
  );

  const days = payload.days;
  const todayIdx = days.findIndex((d) => d.isToday);
  const firstNonPast = days.findIndex((d) => !d.isPast);
  const safeInit = todayIdx >= 0 ? todayIdx : (firstNonPast >= 0 ? firstNonPast : 0);
  const [dayIdx, setDayIdx] = useState(safeInit);

  // A day the USER explicitly picked is remembered by its dateStr so it
  // survives payload swaps; everything else snaps to Today.
  const pickedDateRef = useRef(null);
  const selectDay = (i) => {
    setDayIdx(i);
    pickedDateRef.current = days[i]?.dateStr || null;
  };

  // Resync dayIdx on payload swap — mock and real payloads put Today at
  // different indices (mock: 1; real: after up-to-4 past days). Re-find the
  // user's picked day by DATE in the new payload; if they hadn't picked one
  // (or it's gone), snap to Today. The old check only fired when the stale
  // index landed on a past day — if the past-days fetch failed, index 1 was
  // "Tmrw" and the user silently read tomorrow's forecast as today's.
  useEffect(() => {
    const tIdx = days.findIndex((d) => d.isToday);
    const wanted = pickedDateRef.current
      ? days.findIndex((d) => d.dateStr === pickedDateRef.current)
      : -1;
    if (wanted >= 0) setDayIdx(wanted);
    else if (tIdx >= 0) setDayIdx(tIdx);
    else setDayIdx(safeInit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPayload]);

  const day = days[dayIdx] || days[safeInit];

  // Current hour in the SPOT's timezone — day.hours[].hour are spot-local.
  // Using the device clock here pre-selected the wrong hour (and mis-dimmed
  // "past" hours) for anyone browsing a spot outside their own timezone.
  const currentHour = (() => {
    let h;
    try {
      const tz = effectiveSpot.timezone;
      h = parseInt(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz || undefined }).format(new Date()), 10);
    } catch { h = new Date().getHours(); }
    if (!Number.isFinite(h)) h = new Date().getHours();
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

  // Clamp: selectedIdx resets in an effect AFTER render, so switching to a
  // day with fewer hours would read hours[15] of an 8-hour day → undefined
  // → TypeError in coherentVerdict on the intermediate render.
  const hour = day.hours[Math.min(selectedIdx, day.hours.length - 1)] || day.hours[0];
  const swapKey = useSwapKey(`${dayIdx}-${selectedIdx}`);

  // "UPDATED Xm AGO" — dérivé de lastFetchAt (timestamp du dernier fetch
  // réussi OU de la mise en cache pour un seed cached). L'ancien compteur
  // remis à 0 à chaque swap de payload affichait "0M AGO" pour un cache
  // d'il y a 3 heures.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(tick);
  }, []);
  const agoMin = lastFetchAt ? Math.max(0, Math.round((nowTick - lastFetchAt) / 60000)) : 0;
  const agoLabel = agoMin < 60 ? `${agoMin}M` : `${Math.round(agoMin / 60)}H`;

  const verdict = coherentVerdict(hour);
  const [scoreOpen, setScoreOpen] = useState(false);

  // DangerBanner — safety banner for learners on a hard SKIP driven by a
  // physical hazard (rip, size, blown wind, reef). Was documented in
  // CLAUDE.md as active but had been silently dropped from the build.
  const danger = useMemo(() => {
    const isLearner = effectiveLevel === "first_timer" || effectiveLevel === "beginner" || effectiveLevel === "early_int";
    if (!isLearner) return false;
    const hourDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
    if (getPersonalVerdict(effectiveLevel, hourDeg, effectiveSpot) !== "no") return false;
    const cls = classifyConditions(effectiveLevel, hourDeg, effectiveSpot);
    return cls.currentHazard !== "none" || cls.size === "too_big" || cls.wind === "blown" || cls.reefTooMuch;
  }, [effectiveLevel, hour, effectiveSpot]);

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
    // SKIP / MAYBE / GO comes from getPersonalVerdict — the actual decision
    // for this user's level. The Hero score band ("Poor / Fair / Good…") is
    // a separate dimension (objective conditions quality) and can legitimately
    // differ (e.g. "Poor 31/100" objectively + "MAYBE" personally for an
    // early_int on small + clean = good practice day). We pass pv straight
    // into getPersonalAdviceKey so the tip branch is locked to the same
    // verdict — label and tip can never disagree.
    const pv = getPersonalVerdict(effectiveLevel, hourDeg, effectiveSpot);
    const adviceKey = getPersonalAdviceKey(effectiveLevel, hourDeg, effectiveSpot, pv);
    const modifierKey = getPersonalModifier(effectiveLevel, hourDeg, effectiveSpot);
    const tideModKey = getTideModifier(hour, day.hours);
    const tipRaw = t(adviceKey);
    const tipText = (!tipRaw || tipRaw === adviceKey || tipRaw.startsWith("tip_")) ? verdict.sub : tipRaw;
    const levelLabel = t("lvl_" + effectiveLevel) || effectiveLevel;
    const verdictLabel = pv === "yes" ? (t("go") || "GO") : pv === "ok" ? (t("maybe") || "MAYBE") : (t("skip") || "SKIP");
    const verdictColor = pv === "yes" ? "#16a34a" : pv === "ok" ? "#ea580c" : "#dc2626";
    const modifier = modifierKey ? t(modifierKey) : null;
    const tideMod = tideModKey ? t(tideModKey) : null;
    const isValid = (s, k) => s && s !== k && !s.startsWith("tip_");

    // Board recommendation — short inline label (e.g. "Foamie 7'–8'",
    // "Shortboard 6'0–6'4"). Hidden when verdict is SKIP (no board advice
    // makes sense when the session itself is off).
    // faceFtOf lit la partition dominante + l'atténuation du spot (cache
    // hour.faceFt posé par realFetch) — la reco planche parle de la vague
    // que le score note, pas de la houle primaire.
    const faceFt = faceFtOf(hour, effectiveSpot);
    const boardRec = pv !== "no" ? getBoardRec(effectiveLevel, faceFt, hour.swellPeriod || 0, effectiveSpot) : null;

    return (
      <>
        <strong>{levelLabel}</strong>
        {" "}<span style={{ color: verdictColor, fontWeight: 600 }}>· {verdictLabel}</span>
        {" — "}{tipText}
        {boardRec && boardRec.short && boardRec.short !== "—" && (
          <span className="C-reason-mod">🏄 {boardRec.short}</span>
        )}
        {isValid(modifier, modifierKey) && <span className="C-reason-mod">{modifier}</span>}
        {isValid(tideMod,  tideModKey)  && <span className="C-reason-mod">{tideMod}</span>}
      </>
    );
  }, [effectiveLevel, hour, effectiveSpot, day.hours, t, verdict.sub]);

  // Contextual session notes — safety, wind-shift, tide window, foamie
  // inside advice. Computed per-hour so the ScoreSheet can show them.
  const sessionNotes = useMemo(() => {
    const hourDeg = { ...hour, swellDir: hour.swellDirDeg ?? hour.swellDir, windDir: hour.windDirDeg ?? hour.windDir };
    return getSessionNotes(effectiveLevel, hourDeg, day.hours, effectiveSpot);
  }, [effectiveLevel, hour, day.hours, effectiveSpot]);

  const faceFtForSheet = faceFtOf(hour, effectiveSpot);
  const boardRecForSheet = getBoardRec(effectiveLevel, faceFtForSheet, hour.swellPeriod || 0, effectiveSpot);

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
    const url = `${window.location.origin}/?spot=${encodeURIComponent(spot.id)}`;
    track("share_clicked", { spotId: spot.id });
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
          </div>
          {/* Bannière rouge UNIQUEMENT après un vrai échec sans cache. Pendant
              le chargement ("loading", visible seulement au changement de spot
              mid-session — au lancement le splash couvre) : chip neutre. Échec
              avec cache : bannière douce, les données affichées sont réelles. */}
          {dataSource === "mock" && (
            <div className="mock-banner" role="status">
              ⚠ {t("mock_banner") || "Live forecast unavailable — showing sample data. Check your connection."}
            </div>
          )}
          {dataSource === "loading" && (
            <div className="loading-banner" role="status">
              {t("loading_banner") || "Loading live forecast…"}
            </div>
          )}
          {dataSource === "cached-stale" && (
            <div className="loading-banner" role="status">
              {t("cached_banner") || "Can't refresh right now — showing the last live forecast."}
            </div>
          )}
        </div>

        <div className="rise-2">
          <div className="day-tabs" ref={dayTabsRef}>
            {days.map((d, i) => (
              <button
                key={i}
                onClick={(e) => {
                  selectDay(i);
                  track("day_switched", { dayIdx: i, label: d.label });
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
              onClick={() => selectDay(i)}
              className={`dt ${i === dayIdx ? "active" : ""} ${d.isPast ? "past" : ""}`}
            >
              <div className="dt-day">{d.label}</div>
              <div className="dt-date">{d.dateLabel}</div>
              <div className="dt-dot" style={{ background: d.bestLevel.color }}/>
            </button>
          ))}
        </div>

        {/* Badge de fraîcheur pour toute donnée RÉELLE (live ou cache) —
            jamais pour le mock ni pendant un chargement. */}
        {(dataSource === "live" || dataSource === "cached" || dataSource === "cached-stale") && (
          <div className="rise-2" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--text-dim)", letterSpacing: "0.12em" }}>
              UPDATED {agoLabel} AGO
            </span>
          </div>
        )}

        <VerdictHero verdict={verdict} hour={hour} swapKey={swapKey} onOpenScore={() => { track("score_sheet_opened", { score: hour.score, verdict: verdict.key }); setScoreOpen(true); }}/>

        {danger && (
          <div className="danger-banner" role="alert">
            {t("danger_banner") || "⚠️ Dangerous conditions for your level — check on-site before paddling out"}
          </div>
        )}

        {scoreOpen && <ScoreSheet hour={hour} verdict={verdict} userLevel={effectiveLevel} boardRec={boardRecForSheet} sessionNotes={sessionNotes} spot={effectiveSpot} tideCtx={day.tideCtx || dayTideCtx(day.hours)} t={t} onClose={() => setScoreOpen(false)}/>}

        <div className="lvl-inline rise-3">
          <button className="lvl-me-btn" onClick={onOpenLevel}>
            {userLevel ? (t("lvl_" + userLevel) || userLevel) : (t("pick_level") || "Your level")} <span className="chev">▾</span>
          </button>
        </div>

        {/* Sentinel — its captured offsetTop is the "lock" threshold. Sits
            directly above the bar in normal flow. scrollTop ≥ threshold ⇒ stuck. */}
        <div ref={sibSentinelRef} aria-hidden="true" style={{ height: 1, pointerEvents: "none" }}/>

        <StickyInfoBar
          hour={hour}
          swapKey={swapKey}
          reasonText={personalReason}
          stuck={sibStuck}
          dayHours={day.hours}
          allHours={payload.days.flatMap((d) => d.hours)}
          sunByDay={payload.sunByDay}
          tz={effectiveSpot.timezone || spot.timezone || "Australia/Perth"}
          t={t}
          effectiveSpot={effectiveSpot}
        />

        <DrivingChips hour={hour} spot={effectiveSpot} userLevel={effectiveLevel}/>

        <BestWindow day={day}/>

        {/* No key={effectiveLevel} — remounting on level change wiped the
            user's cards/list choice and scroll position; props updates
            re-render just fine. */}
        <HourlyList
          hours={day.hours}
          selectedIdx={Math.min(selectedIdx, day.hours.length - 1)}
          onSelect={(idx) => { setSelectedIdx(idx); const h = day.hours[idx]; if (h) track("hour_selected", { hour: h.hour, score: h.score }); }}
          currentHour={currentHour}
          sunByDay={payload.sunByDay}
          reasonText={personalReason}
          isToday={!!day.isToday}
          isPastDay={!!day.isPast}
        />

        <TideCurve hours={day.hours} selectedIdx={Math.min(selectedIdx, day.hours.length - 1)} onSelect={setSelectedIdx}/>

        <LevelMatrix hour={hour} spot={effectiveSpot} userLevel={userLevel} t={t}/>

        <Footer t={t}/>
      </div>
    </Phone>
  );
}
