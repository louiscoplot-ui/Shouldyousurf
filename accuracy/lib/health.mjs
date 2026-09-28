// Health check of one logger run, as a pure function so it can be tested.
//
// Forecast and model: a stage fails when less than `min` of its targets
// produced data. Those targets are ours (the app's breaks, Open-Meteo at
// fixed points): a gap there means something on our side broke.
//
// Buoy observations are different. A buoy that answered but published
// nothing in the window is the SOURCE being silent, not the logger failing.
// Seen on 28/09/2026: 8 of the 21 mapped AODN sites stopped publishing on
// 21/09 at the same minute, with no replacement folder in the dataset. The
// old rule counted them as failures and turned every run red, which would
// have trained everyone to ignore red runs. So for obs:
//   - `failed` (fetch threw: network, S3, parsing) counts against `min`;
//   - `silent` sites are reported, not counted as failures;
//   - but if NO site has data at all, the stage fails anyway: that is more
//     likely our reader breaking than every operator going quiet at once.
export function healthProblems(summary, { breaks, min }) {
  const problems = [];
  const pct = (v) => `${Math.round(v * 100)}%`;
  if (summary.forecast) {
    const r = summary.forecast.breaks_ok / Math.max(1, breaks);
    if (r < min) problems.push(`forecast: ${summary.forecast.breaks_ok}/${breaks} breaks (${pct(r)})`);
  }
  if (summary.model) {
    const r = summary.model.sites_ok / Math.max(1, summary.model.sites);
    if (r < min) problems.push(`model: ${summary.model.sites_ok}/${summary.model.sites} sites (${pct(r)})`);
  }
  if (summary.obs) {
    const { sites, sites_ok, sites_failed = 0 } = summary.obs;
    const reachable = (sites - sites_failed) / Math.max(1, sites);
    if (reachable < min) problems.push(`obs: ${sites_failed}/${sites} sites could not be read (${pct(1 - reachable)})`);
    if (sites > 0 && sites_ok === 0) problems.push(`obs: no site returned any observation`);
  }
  return problems;
}
