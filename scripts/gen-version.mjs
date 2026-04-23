// Writes public/version.json at build time so the client-side heartbeat
// (app/lib/versionCheck.js) can detect when Vercel has shipped a new build
// and force a reload — users with a cached PWA don't have to reinstall.
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

let sha = "nogit";
try { sha = execSync("git rev-parse --short HEAD").toString().trim(); } catch {}
const version = `${sha}-${Date.now()}`;

mkdirSync("public", { recursive: true });
writeFileSync("public/version.json", JSON.stringify({ version }) + "\n");
console.log("version.json →", version);
