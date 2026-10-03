// Garde-fou des slides Instagram : une ligne = UNE session homogène.
// Les heures ci-dessous sont les VRAIES heures de Trigg du samedi 3 oct 2026
// (moteur déployé 3aca995) : le cas qui a produit la slide fausse
// « Best 6-7am, 8-11am, 5-6pm · 2-4 ft · 15 km/h SSW » (fenêtre de 3 plages,
// chiffres d'une seule heure : 17h).
import { describe, it, expect } from "vitest";
import { buildSessions, windowText24, windowText12, faceText, windText, signatureOf } from "../scripts/social/lib/sessions.mjs";

const H = (hour, score, verdict, faceLow, faceHigh, windKmh, windDir, windType) => ({
  hour, score, verdict, faceLow, faceHigh, windKmh, windDir, windType,
  swellH: 1.1 + (hour - 6) * 0.015, swellP: 10.8, swellDir: "WSW",
});
const W = [ // [heure, vent km/h, dir, type]
  [6, 6, "SE", "cross-shore"], [7, 7, "ESE", "offshore"], [8, 6, "E", "offshore"], [9, 3, "E", "offshore"],
  [10, 1, "SW", "cross-shore"], [11, 6, "SW", "onshore"], [12, 11, "SW", "onshore"], [13, 14, "SW", "onshore"],
  [14, 15, "SW", "cross-shore"], [15, 15, "SW", "cross-shore"], [16, 18, "SW", "cross-shore"], [17, 15, "SSW", "cross-shore"],
];
const mk = (scores, verdicts) => W.map(([h, k, d, t], i) =>
  H(h, scores[i], verdicts[i], h < 12 ? 1 : 2, h < 12 ? 3 : 4, k, d, t));

const INT = mk([41, 38, 42, 43, 41, 36, 33, 34, 36, 37, 39, 45], Array(12).fill("WORTH IT"));
const EARLY = mk([55, 52, 57, 59, 55, 49, 45, 46, 47, 47, 48, 50], Array(12).fill("GO"));

describe("sessions : samedi 3 oct à Trigg (cas réel)", () => {
  it("Intermediate : la session principale est 17h-18h, avec SES chiffres (2-4 ft, 15 km/h SSW)", () => {
    const { best, sessions } = buildSessions(INT);
    expect(best.hour).toBe(17);
    const p = sessions[0];
    expect(p.primary).toBe(true);
    expect(windowText24(p)).toBe("17-18h");
    expect(faceText(p)).toBe("2-4ft");
    expect(windText(p)).toBe("15 km/h SSW cross");
    expect(p.peakScore).toBe(45);
  });

  it("Intermediate : le matin est une AUTRE ligne (1-3 ft, vent léger), jamais fusionné avec 17h", () => {
    const { sessions } = buildSessions(INT);
    const m = sessions.find((s) => !s.primary);
    expect(m).toBeTruthy();
    expect(windowText24(m)).toBe("06-07h + 08-11h");
    expect(windowText12(m)).toBe("6-7am, 8-11am");
    expect(faceText(m)).toBe("1-3ft");
    expect(m.wind.cls).toBe("light");
    expect(windText(m)).toBe("1-6 km/h light");
    expect(m.peakScore).toBe(43);
  });

  it("Early intermediate : une seule session GO le matin, 1-3 ft, vent léger", () => {
    const { sessions } = buildSessions(EARLY);
    expect(sessions).toHaveLength(1);
    expect(windowText24(sessions[0])).toBe("06-07h + 08-11h");
    expect(faceText(sessions[0])).toBe("1-3ft");
    expect(sessions[0].verdict).toBe("GO");
    expect(sessions[0].peakHour).toBe(9);
  });
});

describe("sessions : invariants (aucune ligne ne mélange deux conditions)", () => {
  const cases = { INT, EARLY };
  for (const [name, hours] of Object.entries(cases)) {
    it(`${name} : toutes les heures d'une session ont la même signature et un vent resserré`, () => {
      const { sessions } = buildSessions(hours);
      for (const s of sessions) {
        const hs = hours.filter((h) => s.hours.includes(h.hour));
        expect(new Set(hs.map(signatureOf)).size).toBe(1);
        expect(s.wind.max - s.wind.min).toBeLessThanOrEqual(8);
        expect(Math.max(...hs.map((h) => h.score))).toBe(s.peakScore);
      }
    });
    it(`${name} : une heure n'apparaît que dans une session, et seulement si score >= meilleur - 5`, () => {
      const { sessions, threshold } = buildSessions(hours);
      const all = sessions.flatMap((s) => s.hours);
      expect(new Set(all).size).toBe(all.length);
      for (const hr of all) expect(hours.find((h) => h.hour === hr).score).toBeGreaterThanOrEqual(threshold);
    });
  }

  it("une session SKIP meilleure en score qu'ailleurs ne devient pas une alternative affichée", () => {
    const hs = [H(7, 40, "WORTH IT", 1, 3, 5, "E", "offshore"), H(8, 44, "SKIP", 2, 4, 22, "W", "onshore"), H(9, 41, "WORTH IT", 1, 3, 5, "E", "offshore")];
    const { best, sessions } = buildSessions(hs);
    expect(best.hour).toBe(8);
    expect(sessions[0].verdict).toBe("SKIP");
    expect(sessions.length).toBe(2);
  });

  it("'all day' seulement si la session couvre >= 75 % des heures de jour", () => {
    const hs = Array.from({ length: 12 }, (_, i) => H(6 + i, 50, "GO", 2, 4, 5, "E", "offshore"));
    expect(buildSessions(hs).sessions[0].allDay).toBe(true);
    const hs2 = hs.map((h, i) => (i < 5 ? h : { ...h, score: 20 }));
    expect(buildSessions(hs2).sessions[0].allDay).toBe(false);
  });

  it("vent léger : 1 km/h SW cross et 6 km/h E offshore sont la même condition", () => {
    const a = H(8, 50, "GO", 1, 3, 1, "SW", "cross-shore"), b = H(9, 50, "GO", 1, 3, 6, "E", "offshore");
    expect(signatureOf(a)).toBe(signatureOf(b));
    const c = H(10, 50, "GO", 1, 3, 12, "E", "offshore");
    expect(signatureOf(a)).not.toBe(signatureOf(c));
  });
});
