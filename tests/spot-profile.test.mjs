// AI spot agent: the decision rules and the agent loop, with a FAKE Anthropic
// client. No network, no key, no cost.
import { describe, it, expect, afterEach } from "vitest";
import {
  PROFILE_VERSION, isHighConfidence, applyProfileToSpot, validateProfileRequest, profileCacheKey,
} from "../app/lib/spotProfile.js";
import { researchSpot, searchedUrlsOf, SpotAgentError } from "../app/lib/spotAgent.server.js";

const good = {
  version: PROFILE_VERSION, bottom: "reef", heavy: false, confidence: "high",
  sources: [{ url: "https://www.surf-guide.example/thomas" }, { url: "https://bali-surf.example/spots/thomas" }],
};
const custom = { id: "custom--8.8100-115.0900", name: "Thomas Beach", lat: -8.81, lng: 115.09, type: "beach", swellAttenuation: undefined };

describe("high-confidence gate", () => {
  it("accepts high confidence + two distinct https hosts + known bottom", () => {
    expect(isHighConfidence(good)).toBe(true);
  });
  it.each([
    ["medium confidence", { ...good, confidence: "medium" }],
    ["one host twice", { ...good, sources: [{ url: "https://a.example/1" }, { url: "https://www.a.example/2" }] }],
    ["http source", { ...good, sources: [{ url: "https://a.example/1" }, { url: "http://b.example/2" }] }],
    ["unknown bottom", { ...good, bottom: "point" }],
    ["old version", { ...good, version: 0 }],
    ["heavy missing", { ...good, heavy: undefined }],
  ])("rejects %s", (_, p) => expect(isHighConfidence(p)).toBe(false));
});

describe("applyProfileToSpot", () => {
  it("sets type and heavy on a searched spot, nothing else", () => {
    const out = applyProfileToSpot(custom, { ...good, heavy: true });
    expect(out.type).toBe("reef");
    expect(out.heavy).toBe(true);
    expect(out.swellAttenuation).toBeUndefined();
    expect(out.lat).toBe(custom.lat);
    expect(out.profileSource).toBe("agent");
  });
  it("never touches a curated spot", () => {
    const trigg = { id: "trigg", type: undefined };
    expect(applyProfileToSpot(trigg, good)).toBe(trigg);
  });
  it("returns the same object when the gate fails (stable React deps)", () => {
    expect(applyProfileToSpot(custom, { ...good, confidence: "low" })).toBe(custom);
    expect(applyProfileToSpot(custom, null)).toBe(custom);
  });
});

describe("request validation", () => {
  it("accepts a normal request and strips control characters", () => {
    const r = validateProfileRequest({ name: "Thomas\nBeach", lat: -8.81, lng: "115.09" });
    expect(r).toEqual({ ok: true, value: { name: "Thomas Beach", region: "", lat: -8.81, lng: 115.09 } });
  });
  it.each([[{}], [{ name: "x", lat: 91, lng: 0 }], [{ name: "x", lat: 0, lng: "abc" }], [{ name: "", lat: 0, lng: 0 }], [null]])(
    "rejects %j", (b) => expect(validateProfileRequest(b).ok).toBe(false));
  it("cache key rounds to ~1 km", () => {
    expect(profileCacheKey({ lat: -8.81234, lng: 115.0911 })).toBe(profileCacheKey({ lat: -8.8149, lng: 115.0949 }));
  });
});

// Fake client: scripted replies for beta.messages.create, one parse reply.
function fakeClient({ creates, parse }) {
  const calls = { create: [], parse: [] };
  return {
    calls,
    beta: { messages: {
      create: async (p) => { calls.create.push(structuredClone(p)); return creates.shift(); },
      parse: async (p) => { calls.parse.push(p); return parse; },
    } },
  };
}
const searchBlock = (...urls) => ({ type: "web_search_tool_result", tool_use_id: "t", content: urls.map((url) => ({ type: "web_search_result", url, title: url, encrypted_content: "x", page_age: null })) });
const req = { name: "Thomas Beach", region: "Kuta Selatan", lat: -8.81, lng: 115.09 };

describe("researchSpot (fake client)", () => {
  it("drops sources the search never returned, keeps the rest", async () => {
    const client = fakeClient({
      creates: [{ model: "claude-opus-5-5", stop_reason: "end_turn", content: [
        searchBlock("https://a.example/thomas", "https://b.example/bali#reef"),
        { type: "text", text: "Reef break over coral." },
      ] }],
      parse: { model: "claude-opus-5-5", stop_reason: "end_turn", parsed_output: {
        breakName: "Thomas", bottom: "reef", heavy: false, confidence: "high", reasoning: "r", exposureNote: "e",
        sources: [{ url: "https://a.example/thomas", title: "", supports: "" }, { url: "https://b.example/bali", title: "", supports: "" }, { url: "https://invented.example/x", title: "", supports: "" }],
      } },
    });
    const p = await researchSpot(req, { client });
    expect(p.sources.map((s) => s.url)).toEqual(["https://a.example/thomas", "https://b.example/bali"]);
    expect(p.droppedSources).toBe(1);
    expect(isHighConfidence(p)).toBe(true);
    // request shape: web search tool, fallbacks on, adaptive thinking
    const c = client.calls.create[0];
    expect(c.tools[0].type).toBe("web_search_20260209");
    expect(c.fallbacks).toBe("default");
    expect(c.thinking).toEqual({ type: "adaptive" });
    expect(client.calls.parse[0].messages[0].content).toContain("https://b.example/bali");
  });

  it("a profile backed only by invented links fails the gate", async () => {
    const client = fakeClient({
      creates: [{ stop_reason: "end_turn", content: [searchBlock("https://a.example/1"), { type: "text", text: "x" }] }],
      parse: { stop_reason: "end_turn", parsed_output: { breakName: "x", bottom: "reef", heavy: false, confidence: "high", reasoning: "", exposureNote: "",
        sources: [{ url: "https://a.example/1", title: "", supports: "" }, { url: "https://made-up.example/2", title: "", supports: "" }] } },
    });
    const p = await researchSpot(req, { client });
    expect(isHighConfidence(p)).toBe(false);
  });

  it("resumes after pause_turn by sending the paused content back", async () => {
    const paused = [searchBlock("https://a.example/1")];
    const client = fakeClient({
      creates: [
        { stop_reason: "pause_turn", content: paused },
        { stop_reason: "end_turn", content: [searchBlock("https://b.example/2"), { type: "text", text: "done" }] },
      ],
      parse: { stop_reason: "end_turn", parsed_output: { breakName: "x", bottom: "beach", heavy: false, confidence: "medium", reasoning: "", exposureNote: "", sources: [] } },
    });
    await researchSpot(req, { client });
    expect(client.calls.create).toHaveLength(2);
    expect(client.calls.create[1].messages.at(-1)).toEqual({ role: "assistant", content: paused });
    const listed = client.calls.parse[0].messages[0].content;
    expect(listed).toContain("https://a.example/1");
    expect(listed).toContain("https://b.example/2");
  });

  it("throws on refusal", async () => {
    const client = fakeClient({ creates: [{ stop_reason: "refusal", content: [] }], parse: null });
    await expect(researchSpot(req, { client })).rejects.toBeInstanceOf(SpotAgentError);
  });

  it("searchedUrlsOf ignores everything but search results", () => {
    expect(searchedUrlsOf([{ type: "text", text: "https://x.example" }, searchBlock("https://y.example")])).toEqual(["https://y.example"]);
  });
});

describe("API route", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it("answers 503 when the feature is off, without calling anything", async () => {
    delete process.env.SPOT_AGENT_ENABLED;
    const { POST } = await import("../app/api/spot-profile/route.js");
    const res = await POST(new Request("http://x/api/spot-profile", { method: "POST", body: JSON.stringify(req) }));
    expect(res.status).toBe(503);
  });
  it("answers 400 on a bad body when on", async () => {
    process.env.SPOT_AGENT_ENABLED = "1";
    process.env.ANTHROPIC_API_KEY = "test-dummy";
    const { POST } = await import("../app/api/spot-profile/route.js");
    const res = await POST(new Request("http://x/api/spot-profile", { method: "POST", body: JSON.stringify({ lat: 0 }) }));
    expect(res.status).toBe(400);
  });
});
