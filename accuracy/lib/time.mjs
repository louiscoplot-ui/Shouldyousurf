// Time helpers. Everything in the log is UTC ("YYYY-MM-DDTHH:00Z").

// "2026-09-27T06:00" in `timeZone` -> Date (UTC instant). Handles DST by
// asking Intl for the zone's offset at that moment (two passes are enough
// for any real zone).
export function localToUtc(localIso, timeZone) {
  const [d, t] = localIso.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = (t || "00:00").split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

function offsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}

export const hourKey = (date) => `${new Date(date).toISOString().slice(0, 13)}:00Z`;
export const monthKey = (date) => new Date(date).toISOString().slice(0, 7);
export const floorHour = (date) => new Date(Math.floor(new Date(date).getTime() / 3600e3) * 3600e3);
