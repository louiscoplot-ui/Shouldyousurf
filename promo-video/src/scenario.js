// The Trigg Beach morning the whole video is built on.
//
// Plain data, no Remotion and no DOM: it is shared by
//   - src/data.js            (feeds the REAL scoring engine for the video)
//   - scripts/screenshots.mjs (served as a fake Open-Meteo response so the
//                              REAL app renders these exact same numbers)
//
// It's a typical spring morning in Perth, not a recorded day: 1.7 m / 14 s
// WSW groundswell, light easterly land breeze at dawn (offshore at Trigg),
// SW sea breeze from ~11h. Edit the numbers here and both the video and
// the reference screenshots follow.

// Trigg exactly as it is in app/breaks.js.
export const SPOT = {
  id: "trigg", name: "Trigg Beach", region: "Perth, WA",
  lat: -31.8826, lng: 115.7519, idealSwellDir: 240, offshoreWindDir: 90,
  idealTide: "mid-high", swellAttenuation: 0.60, type: "beach",
};

export const TIMEZONE = "Australia/Perth";

export const SWELL = { height: 1.7, period: 14, dir: 245 };

// [mean wind km/h, direction the wind comes FROM, deg] for each hour 0-23.
export const WIND_BY_HOUR = [
  [5, 100], [5, 100], [5, 100], [5, 100], [5, 100], // 0-4  land breeze
  [6, 95], [7, 90], [8, 85], [8, 80], [7, 70],      // 5-9  offshore, glassy
  [9, 20],                                          // 10   turning
  [14, 220], [20, 215], [24, 210], [27, 210],       // 11-14 sea breeze
  [28, 210], [26, 215], [22, 215], [16, 210],       // 15-18
  [12, 190], [9, 150], [7, 110], [7, 110], [7, 110] // 19-23
];

// Small diurnal Perth tide, peaking ~9am (metres).
export const tideAt = (hour) => +(0.5 + 0.17 * Math.sin((2 * Math.PI * (hour - 3)) / 24)).toFixed(2);

// One raw hour, in the exact shape realFetch.buildRawHours produces.
export function rawHour(date, hour) {
  const [kmh, dir] = WIND_BY_HOUR[hour];
  return {
    time: `${date}T${String(hour).padStart(2, "0")}:00`,
    hour,
    swellHeight: SWELL.height,
    swellPeriod: SWELL.period,
    swellDir: SWELL.dir,
    windSpeedKn: kmh / 1.852,
    windGustKn: (kmh * 1.4) / 1.852, // gust factor 1.4: calm, realistic
    windDir: dir,
    windWaveHeight: 0.1, windWavePeriod: 3, windWaveDir: 90,
    secSwellH: null, secSwellP: null, secSwellDir: null,
    tideM: tideAt(hour),
    seaTemp: 19, airTemp: 16 + Math.max(0, Math.min(hour, 14) - 6) * 0.8,
    rainProb: 0,
    currentVel: 0.08, currentDir: 180,
  };
}

export const SUNRISE = "05:54";
export const SUNSET = "18:12";
