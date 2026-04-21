"use client";

// v2 Icons — ported as-is from export-v2/v2-shared.jsx.

export function SwellIcon() {
  return (
    <svg className="mi" viewBox="0 0 24 24">
      <path d="M3 14c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/>
      <path d="M3 19c3 0 3-4 6-4s3 4 6 4 3-4 6-4"/>
    </svg>
  );
}
export function WindIcon() {
  return (
    <svg className="mi" viewBox="0 0 24 24">
      <path d="M3 9h12a3 3 0 1 0-3-3"/>
      <path d="M3 14h17a3 3 0 1 1-3 3"/>
    </svg>
  );
}
export function TideIcon() {
  return (
    <svg className="mi" viewBox="0 0 24 24">
      <path d="M3 12c3 0 3-6 6-6s3 6 6 6 3-6 6-6"/>
    </svg>
  );
}
export function SunIcon() {
  return (
    <svg className="mi" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5l1.5-1.5M17 7l1.5-1.5"/>
    </svg>
  );
}
export function DropIcon() {
  return (
    <svg className="mi" viewBox="0 0 24 24">
      <path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"/>
    </svg>
  );
}
export function ArrowIcon({ deg = 0 }) {
  return (
    <svg className="mi" viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }}>
      <path d="M12 4v16M6 10l6-6 6 6"/>
    </svg>
  );
}
