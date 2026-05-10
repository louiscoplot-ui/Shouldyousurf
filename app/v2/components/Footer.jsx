"use client";

// v2 Footer — ported from export-v2/v2-parts.jsx.

export default function Footer({ t }) {
  const tt = typeof t === "function" ? t : ((k) => k);
  const disclaimer = tt("disclaimer");
  const footer = tt("footer");
  return (
    <div className="footer">
      <p>
        {(!disclaimer || disclaimer === "disclaimer")
          ? <>Forecast based on public weather APIs (Open-Meteo / ECMWF / GFS).<br/>Ocean conditions can shift fast — always recheck on the morning of your session and trust what you see at the beach.</>
          : disclaimer}
      </p>
      <div className="attr">{(!footer || footer === "footer") ? "marine data · open-meteo" : footer}</div>
    </div>
  );
}
