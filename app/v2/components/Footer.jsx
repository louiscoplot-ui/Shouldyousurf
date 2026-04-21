"use client";

// v2 Footer — ported from export-v2/v2-parts.jsx.

export default function Footer() {
  return (
    <div className="footer">
      <p>
        Forecast based on public weather APIs (Open-Meteo / ECMWF / GFS).<br/>
        Ocean conditions can shift fast — always recheck on the morning of your session and trust what you see at the beach.
      </p>
      <div className="attr">marine data · open-meteo</div>
    </div>
  );
}
