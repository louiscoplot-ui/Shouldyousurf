// Cache stale-while-revalidate du dernier forecast live — le seed instantané
// au lancement. Verrouille le re-étiquetage par date (un cache d'hier ne doit
// JAMAIS afficher hier comme "Today") et les gardes d'expiration/corruption.
import { describe, it, expect, beforeEach } from "vitest";
import { readCachedPayload, writeCachedPayload, rehydrateCachedPayload } from "../app/v2/lib/realFetch.js";
import { offsetDate } from "../app/v2/lib/prodScoring.js";

const TZ = "Australia/Perth";
const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const mkDay = (dateStr, extra = {}) => ({
  dateStr,
  label: "stale-label",
  dateLabel: "1/1",
  isToday: false,
  isPast: false,
  hours: [{ hour: 8, score: 50, time: `${dateStr}T08:00` }],
  ...extra,
});
const mkPayload = (days) => ({ days, sunByDay: {}, effectiveSpot: { id: "trigg", timezone: TZ } });

// Stub localStorage (vitest tourne en node)
const store = new Map();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
});

describe("rehydrateCachedPayload", () => {
  it("recomputes isToday/isPast/labels from dateStr — a cache from yesterday never shows yesterday as Today", () => {
    // Cache écrit "hier" : son jour isToday=true porte la date d'hier.
    const yesterday = offsetDate(todayStr, -1);
    const days = [
      mkDay(offsetDate(todayStr, -2)),
      mkDay(yesterday, { isToday: true, label: "Today" }), // flags périmés
      mkDay(todayStr, { label: "Tmrw" }),
      mkDay(offsetDate(todayStr, 1)),
    ];
    const out = rehydrateCachedPayload(mkPayload(days), Date.now() - 3600e3);
    expect(out).not.toBe(null);
    const today = out.payload.days.find((d) => d.isToday);
    expect(today.dateStr).toBe(todayStr);
    expect(today.label).toBe("Today");
    const staleYesterday = out.payload.days.find((d) => d.dateStr === yesterday);
    expect(staleYesterday.isToday).toBe(false);
    expect(staleYesterday.isPast).toBe(true);
  });
  it("returns null when the cache no longer covers today", () => {
    const days = [mkDay(offsetDate(todayStr, -3)), mkDay(offsetDate(todayStr, -2))];
    expect(rehydrateCachedPayload(mkPayload(days), Date.now())).toBe(null);
  });
});

describe("readCachedPayload / writeCachedPayload", () => {
  const freshPayload = () => mkPayload([mkDay(todayStr, { isToday: true }), mkDay(offsetDate(todayStr, 1))]);
  it("roundtrips a fresh payload", () => {
    writeCachedPayload("trigg", freshPayload());
    const out = readCachedPayload("trigg");
    expect(out).not.toBe(null);
    expect(out.payload.days.find((d) => d.isToday).dateStr).toBe(todayStr);
    expect(Number.isFinite(out.cachedAt)).toBe(true);
  });
  it("ignores a cache older than 24h", () => {
    store.set("surf-forecast-cache-trigg", JSON.stringify({ v: 1, cachedAt: Date.now() - 25 * 3600e3, payload: freshPayload() }));
    expect(readCachedPayload("trigg")).toBe(null);
  });
  it("survives corrupt or missing entries", () => {
    expect(readCachedPayload("nope")).toBe(null);
    store.set("surf-forecast-cache-bad", "{corrupt");
    expect(readCachedPayload("bad")).toBe(null);
    store.set("surf-forecast-cache-v0", JSON.stringify({ v: 0, cachedAt: Date.now(), payload: freshPayload() }));
    expect(readCachedPayload("v0")).toBe(null);
  });
});
