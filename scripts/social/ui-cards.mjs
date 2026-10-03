// Vérif UI : lit les cartes horaires de la VRAIE app en prod (Playwright, à installer à part : pas une dépendance du repo).
// Compare ensuite avec le moteur sur un payload frais (cf. CLAUDE.md, section Rapports Instagram).
//   node scripts/social/ui-cards.mjs trigg early_int,intermediate   (écrit ui-<spot>.json dans le dossier courant)
// Il faut HTTPS_PROXY et la liste SPKI du proxy de session ci-dessous ; hors session Claude, retirer proxy/args.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const [spot, levelsArg] = process.argv.slice(2); const levels = levelsArg.split(',');
const SPKI = ['PS48cX347wDVcRynzq+DFqswl2PLNE1sG6uQvxMCOS0=', 'KnP1OnzHv/y42eRQmbGwoYTHcSJF448m6CU5mdngwKk=', 'gBdItbWylHhTkoJDRwIiMuweY/qX4F0bJmLNs5wosUQ=', '4FUmu5xjLNSCwT6mnoJy7LpsouczK4qrlGg3VquK6ZE=', 'L+/CZomxifpzjiAVG11S0bTbaTopj+c49s0rBjjSC6A=', '0KMCVL0z7YGtHqARRnTAzBN88j1iAyUWpWormDdohIY='];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', proxy: { server: process.env.HTTPS_PROXY }, args: ['--ignore-certificate-errors-spki-list=' + SPKI.join(',')] });
const res = {};
for (const level of levels) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 420, height: 2400 }, locale: 'en-AU', timezoneId: 'Australia/Perth' });
  await ctx.addInitScript(([l]) => { try { localStorage.setItem('surf-user-level', l); localStorage.setItem('surf-lang', 'en'); localStorage.setItem('surf-onboarded-v2', '1'); localStorage.setItem('ss-no-analytics', '1'); } catch {} }, [level]);
  const page = await ctx.newPage();
  await page.goto(`https://shouldyousurf.com/?spot=${spot}&noanalytics=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__appReady === true, null, { timeout: 40000 });
  await page.waitForTimeout(3000);
  res[level] = await page.evaluate(() => [...document.querySelectorAll('.hly-card')].map((c) => c.innerText.replace(/\n+/g, ' | ')));
  res[level + '_best'] = await page.evaluate(() => document.querySelector('.best')?.innerText.replace(/\n+/g, ' | ') || null);
  await page.screenshot({ path: `ui-${spot}-${level}.png` });
  await ctx.close();
}
await browser.close(); writeFileSync(`ui-${spot}.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 3500));
