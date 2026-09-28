"use client";

// v2 Footer — ported from export-v2/v2-parts.jsx.
// Carries the Open-Meteo attribution (CC BY 4.0): the source and licence
// names are rendered as links by AttributionText.

import AttributionText from "./AttributionText";

const FALLBACK_DISCLAIMER = "Weather and marine data from Open-Meteo.com (CC BY 4.0), based on national weather models including ECMWF and GFS. Scores, verdicts and face heights are our own calculations from this data. Ocean conditions can shift fast — always recheck on the morning of your session and trust what you see at the beach.";
const FALLBACK_FOOTER = "data: Open-Meteo.com · CC BY 4.0 · modified";

export default function Footer({ t }) {
  const tt = typeof t === "function" ? t : ((k) => k);
  const disclaimer = tt("disclaimer");
  const footer = tt("footer");
  return (
    <div className="footer">
      <p>
        <AttributionText text={(!disclaimer || disclaimer === "disclaimer") ? FALLBACK_DISCLAIMER : disclaimer} />
      </p>
      <div className="attr">
        <AttributionText text={(!footer || footer === "footer") ? FALLBACK_FOOTER : footer} />
      </div>
    </div>
  );
}
