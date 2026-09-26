// Brand tokens, copied from the app (app/v2/v2.css default "terracotta"
// theme, app/layout.js splash, app/v2/lib/verdict.js SCORE_SCALE).
export const C = {
  paper: "#f5ede1",      // --bg
  paperHi: "#fbf5ea",    // --paper (raised cards)
  sand: "#ede1cd",       // --bg-el
  ink: "#1a3d3a",        // --text (deep teal-ink)
  inkSoft: "rgba(26,61,58,0.72)",
  border: "rgba(26,61,58,0.14)",
  jade: "#2d7a6e",       // --accent
  coral: "#d47559",      // --coral (sunrise)
  honey: "#d99e4a",      // --honey
  navy: "#0c2a5e",       // splash gradient start
  blue: "#1558b5",       // splash gradient end
  navyDeep: "#081733",   // bottom of the app icon
  amber: "#f59e0b",      // splash small caps
  cream: "#f5efe0",
};

export const F = {
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  body: "'Geist', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
};

// Same treatment as the app's big headings (opsz 96, tight tracking).
export const displayStyle = {
  fontFamily: F.display,
  fontVariationSettings: '"opsz" 96',
  fontWeight: 600,
  letterSpacing: "-0.035em",
  lineHeight: 1.0,
};

export const monoLabel = {
  fontFamily: F.mono,
  fontWeight: 500,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
};
