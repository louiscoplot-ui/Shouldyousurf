"use client";

// v2 hooks — tween a numeric value, bump a key on change.

import { useState, useRef, useEffect } from "react";

export function useTween(target, dur = 400) {
  const [v, setV] = useState(target);
  const ref = useRef({ from: target, to: target, t0: 0, raf: 0 });
  useEffect(() => {
    const r = ref.current;
    r.from = v;
    r.to = target;
    r.t0 = performance.now();
    cancelAnimationFrame(r.raf);
    const tick = (t) => {
      const p = Math.min(1, (t - r.t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(r.from + (r.to - r.from) * e);
      if (p < 1) r.raf = requestAnimationFrame(tick);
    };
    r.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, dur]);
  return v;
}

export function useSwapKey(dep) {
  const [k, setK] = useState(0);
  useEffect(() => { setK((x) => x + 1); }, [dep]);
  return k;
}

export function fmtHour(h) {
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "am" : "pm";
  return `${hh}:00${ampm}`;
}
