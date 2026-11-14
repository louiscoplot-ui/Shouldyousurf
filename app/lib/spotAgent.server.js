// AI spot agent: given a searched beach (name + coordinates), find out what
// the break actually is (sand or reef, heavy or not) from the web, with
// sources. Server only: it needs ANTHROPIC_API_KEY and must never be bundled
// into the browser (the API route and scripts/spot-agent.mjs import it).
//
// Two calls:
//   1. research: Claude with the web_search server tool reads about the spot;
//   2. extract:  a second call turns that research into a fixed JSON shape
//      (structured output, validated by zod).
// Then every source the model cites is checked against the URLs the search
// really returned. A link the model "remembers" but did not fetch is dropped,
// so the two-website rule in spotProfile.js cannot be met by invention.
//
// The Anthropic client is injected (`client`) so tests run with a fake one
// and never touch the network.

import * as z from "zod/v4";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PROFILE_VERSION, BOTTOM_TYPES } from "./spotProfile.js";

export const AGENT_MODEL = "claude-opus-5-5";
// Server-side fallback: if the requested model declines, the API retries on
// its default fallback model inside the same request (the reply's `model`
// field says which one answered; we store it on the profile).
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MAX_SEARCHES = 5;
const MAX_CONTINUATIONS = 3;

export class SpotAgentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ProfileSchema = z.object({
  breakName: z.string().describe("Name of the surf break the coordinates point at, as surfers know it."),
  bottom: z.enum(BOTTOM_TYPES).describe('"reef" for coral, rock, rocky point or boulder bottom; "beach" for sand.'),
  heavy: z.boolean().describe("True only for a famously powerful, dangerous wave (heavy barrels over shallow reef, big-wave spot)."),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().describe("Two or three sentences: what the sources say and why."),
  exposureNote: z.string().describe("What the sources say about how exposed or sheltered the break is. Text only, no coefficient."),
  sources: z.array(z.object({
    url: z.string(),
    title: z.string(),
    supports: z.string().describe("What this page says that supports the answer."),
  })),
});

function researchPrompt({ name, region, lat, lng }) {
  return [
    `A surf forecast app user searched for "${name}"${region ? ` (${region})` : ""}.`,
    `The point they picked is at latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}.`,
    "",
    "Find out what surf break is at or right next to this point, and answer three questions from what web pages say:",
    "1. What is the bottom where the wave breaks: sand, or reef / rock / rocky point?",
    "2. Is it a heavy wave (powerful, dangerous, experts only), or an ordinary break?",
    "3. How exposed to open-ocean swell is it, or what shelters it?",
    "",
    "Search the web. Prefer surf guides, local surf school or tourism pages, and encyclopedic pages over forums.",
    "If the coordinates fall between two known breaks, or the name matches several places, say so plainly.",
    "If the pages disagree or you find little, say that too: an honest 'not sure' is the right answer then.",
    "Finish with a short plain summary of your findings, naming the pages that support each point.",
  ].join("\n");
}

function extractPrompt(request, researchText, searchedUrls) {
  return [
    `Spot searched: "${request.name}"${request.region ? ` (${request.region})` : ""} at ${request.lat.toFixed(4)}, ${request.lng.toFixed(4)}.`,
    "",
    "Research notes:",
    researchText || "(no notes)",
    "",
    "Pages the web search actually returned (cite only these URLs, copied exactly):",
    searchedUrls.length ? searchedUrls.map((u) => `- ${u}`).join("\n") : "(none)",
    "",
    "Fill the profile from the notes only. Rules for confidence:",
    '- "high": at least two different websites clearly state the bottom, and nothing found contradicts it.',
    '- "medium": one clear source, or sources that mostly agree.',
    '- "low": little found, conflicting pages, or unsure which break the coordinates point at.',
    "Never raise confidence to fill a gap.",
  ].join("\n");
}

function normalizeUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

// Collect the URLs of every web_search_tool_result block in a reply.
export function searchedUrlsOf(contentBlocks) {
  const out = [];
  for (const block of contentBlocks || []) {
    if (block?.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r?.type === "web_search_result" && typeof r.url === "string") out.push(r.url);
    }
  }
  return out;
}

function textOf(contentBlocks) {
  return (contentBlocks || []).filter((b) => b?.type === "text").map((b) => b.text).join("\n").trim();
}

async function research(client, request, model) {
  const messages = [{ role: "user", content: researchPrompt(request) }];
  const allBlocks = [];
  let servedBy = null;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const reply = await client.beta.messages.create({
      model,
      max_tokens: 6000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
      messages,
    });
    servedBy = reply.model || servedBy;
    if (reply.stop_reason === "refusal") throw new SpotAgentError("refused", "the model declined the research request");
    allBlocks.push(...(reply.content || []));
    // pause_turn: the server paused a long tool turn. Send the conversation
    // back as is and the server resumes where it stopped.
    if (reply.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: reply.content });
      continue;
    }
    return { blocks: allBlocks, text: textOf(reply.content), servedBy };
  }
  throw new SpotAgentError("too_long", "research did not finish within the continuation limit");
}

// request: { name, region, lat, lng } (validated by validateProfileRequest)
// returns a profile object (see spotProfile.js). Throws SpotAgentError.
export async function researchSpot(request, { client, model = AGENT_MODEL, now = () => new Date() } = {}) {
  if (!client) throw new SpotAgentError("no_client", "no Anthropic client");

  const found = await research(client, request, model);
  const searched = [...new Set(searchedUrlsOf(found.blocks).map(normalizeUrl).filter(Boolean))];

  const parsed = await client.beta.messages.parse({
    model,
    max_tokens: 3000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: betaZodOutputFormat(ProfileSchema) },
    messages: [{ role: "user", content: extractPrompt(request, found.text, searched) }],
  });
  if (parsed.stop_reason === "refusal") throw new SpotAgentError("refused", "the model declined the extraction request");
  const out = parsed.parsed_output;
  if (!out) throw new SpotAgentError("bad_output", `no structured output (stop_reason ${parsed.stop_reason})`);

  // Keep only sources the search really returned.
  const searchedSet = new Set(searched);
  const sources = (out.sources || []).filter((s) => searchedSet.has(normalizeUrl(s.url)));
  const dropped = (out.sources || []).length - sources.length;

  return {
    version: PROFILE_VERSION,
    breakName: out.breakName,
    bottom: out.bottom,
    heavy: out.heavy,
    confidence: out.confidence,
    reasoning: out.reasoning,
    exposureNote: out.exposureNote,
    sources,
    droppedSources: dropped,
    model: parsed.model || found.servedBy || model,
    researchedAt: now().toISOString(),
    lat: request.lat,
    lng: request.lng,
    query: request.name,
  };
}
