// Shared weather route: whitelist, cache headers, errors never cached.
import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "../app/api/wx/route.js";

const call = (u) => GET(new Request(`http://x/api/wx?u=${encodeURIComponent(u)}`));
afterEach(() => vi.unstubAllGlobals());

describe("/api/wx", () => {
  it("refuses anything outside the weather APIs", async () => {
    expect((await call("https://evil.example/v1/marine")).status).toBe(403);
    expect((await call("https://api.open-meteo.com/v1/archive?x=1")).status).toBe(403);
    expect((await call("http://api.open-meteo.com/v1/forecast")).status).toBe(403);
    expect((await call("not a url")).status).toBe(400);
  });
  it("shares a forecast for 30 min at the CDN", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"ok":1}', { status: 200 })));
    const res = await call("https://marine-api.open-meteo.com/v1/marine?latitude=1&longitude=2&forecast_days=5");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=1800");
    expect(await res.text()).toBe('{"ok":1}');
  });
  it("never caches an upstream error (429 stays retryable)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"error":true}', { status: 429 })));
    const res = await call("https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2");
    expect(res.status).toBe(429);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("keeps elevation (coastline) for 30 days", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"elevation":[0]}', { status: 200 })));
    const res = await call("https://api.open-meteo.com/v1/elevation?latitude=1&longitude=2");
    expect(res.headers.get("cache-control")).toContain(`s-maxage=${30 * 24 * 3600}`);
  });
});
