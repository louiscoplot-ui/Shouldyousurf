"use client";

// Renders a translated string and turns the data-source names into links,
// as Open-Meteo's CC BY 4.0 terms require ("a link next to any location
// Open-Meteo data are displayed" + a link to the licence).
//
// The two names are written verbatim in every language in app/i18n.js, so
// translators never have to handle markup: a string only needs to contain
// "Open-Meteo.com" and/or "CC BY 4.0" and they become links here.
const LINKS = {
  "Open-Meteo.com": "https://open-meteo.com/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
};
const PATTERN = /(Open-Meteo\.com|CC BY 4\.0)/;

export default function AttributionText({ text }) {
  if (typeof text !== "string" || !text) return null;
  return text.split(PATTERN).map((part, i) =>
    LINKS[part]
      ? <a key={i} href={LINKS[part]} target="_blank" rel="noopener noreferrer">{part}</a>
      : part
  );
}
