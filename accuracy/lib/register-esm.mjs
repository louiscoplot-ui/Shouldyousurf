// Lets Node import the app's own modules unchanged.
//
// The app is bundled by Next.js, so its imports omit the file extension
// (`import ... from "./prodScoring"`). Node's ES module loader requires the
// extension. This hook retries an extensionless relative import with ".js".
// It only affects relative specifiers that fail to resolve; nothing else.
//
//   node --import ./lib/register-esm.mjs scripts/daily-log.mjs
import { register } from "node:module";

register("./esm-extension-hooks.mjs", import.meta.url);
