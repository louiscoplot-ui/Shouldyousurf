// Remotion CLI config (read by `npx remotion ...` only, never by the app).
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.js");
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setPixelFormat("yuv420p"); // what Facebook / Instagram expect
Config.setCrf(18);
Config.setColorSpace("bt709");
// Remotion downloads its own headless Chromium on first run. Where that is
// blocked (like the cloud session this was built in), point it at a local
// Chrome/Chromium: REMOTION_BROWSER=/path/to/chrome npm run render
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
