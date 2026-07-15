import { describe, expect, it } from "vitest";
import type { Fingerprint } from "../fingerprint.js";
import { GeminiProvider } from "./geminiProvider.js";
import type { FallbackContext } from "./verdict.js";

const FEATURES = {
  tag: "button",
  attrs: { "data-testid": "wizard-next" },
  text: "Next",
  label: null,
  ancestors: [],
  siblingIndex: 0,
  siblingCount: 2,
  bbox: { x: 0, y: 0, w: 64, h: 32 },
} as const;

const FINGERPRINT: Fingerprint = { v: 1, ...FEATURES };

const CTX: FallbackContext = {
  fingerprint: FINGERPRINT,
  candidates: [
    {
      features: FEATURES,
      breakdown: {
        attrOverlap: 0.5,
        textSimilarity: 0.5,
        labelMatch: 0,
        ancestorChain: 0.5,
        siblingPosition: 0.5,
        bboxProximity: 0.5,
      },
      total: 0.5,
      selector: "button",
      domIndex: 0,
    },
  ],
  confidence: 0.5,
  margin: 0.01,
};

const API_KEY = "test-api-key-never-logged";

interface RecordedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/** Fake-fetch seam: returns the scripted response, records what was sent. */
function providerWith(
  response: Response | Error,
  recorded: RecordedRequest[] = [],
): GeminiProvider {
  const fetchFn: typeof fetch = (input, init) => {
    recorded.push({ url: String(input), init: init ?? {} });
    if (response instanceof Error) return Promise.reject(response);
    return Promise.resolve(response);
  };
  return new GeminiProvider({ apiKey: API_KEY, model: "test-model", fetchFn });
}

function geminiReply(verdictJson: string, usage = true): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: verdictJson }] } }],
      ...(usage ? { usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 40 } } : {}),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("GeminiProvider — the untrusted boundary", () => {
  it("a well-formed reply parses into a chose verdict, with measured meta", async () => {
    const provider = providerWith(geminiReply('{"chosenCandidateIndex": 0, "reasoning": "same testid"}'));
    const { verdict, meta } = await provider.judge(CTX);
    expect(verdict).toEqual({ kind: "chose", candidateIndex: 0, reasoning: "same testid" });
    expect(meta).toMatchObject({ inputTokens: 800, outputTokens: 40 });
    expect(meta?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("a null index means none-of-them — a real answer, not a failure", async () => {
    const provider = providerWith(geminiReply('{"chosenCandidateIndex": null, "reasoning": "nothing matches"}'));
    const { verdict } = await provider.judge(CTX);
    expect(verdict).toEqual({ kind: "none-of-them", reasoning: "nothing matches" });
  });

  it.each([
    ["schema-violating verdict (string confidence-style junk)", geminiReply('{"chosenCandidateIndex": "first one", "reasoning": "trust me"}'), /^verdict-schema-invalid:/],
    ["verdict that is not JSON at all", geminiReply("I think it is candidate zero."), /^verdict-not-json$/],
    ["empty parts", new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), { status: 200 }), /^empty-reply$/],
    ["envelope that is not the API shape", new Response(JSON.stringify({ unexpected: true }), { status: 200 }), /^envelope-schema-invalid$/],
    ["HTTP 429", new Response("rate limited", { status: 429 }), /^http-429$/],
    ["HTTP 500", new Response("boom", { status: 500 }), /^http-500$/],
    ["network failure", new Error("socket hang up"), /^network-error$/],
  ])("%s → no-verdict, never a throw", async (_desc, response, reasonPattern) => {
    const provider = providerWith(response);
    const { verdict } = await provider.judge(CTX);
    expect(verdict.kind).toBe("no-verdict");
    if (verdict.kind === "no-verdict") expect(verdict.reason).toMatch(reasonPattern);
  });

  it("sends the key only as a header — never in the URL, so it cannot leak into request logs", async () => {
    const recorded: RecordedRequest[] = [];
    await providerWith(geminiReply('{"chosenCandidateIndex": 0, "reasoning": "ok"}'), recorded).judge(CTX);

    const request = recorded[0];
    expect(request).toBeDefined();
    expect(request?.url).not.toContain(API_KEY);
    expect(request?.url).toContain("test-model:generateContent");
    expect(new Headers(request?.init.headers).get("x-goog-api-key")).toBe(API_KEY);
    // The prompt body must not contain the key either.
    expect(String(request?.init.body)).not.toContain(API_KEY);
  });

  it("requests strict JSON output with the verdict schema and temperature 0", async () => {
    const recorded: RecordedRequest[] = [];
    await providerWith(geminiReply('{"chosenCandidateIndex": 0, "reasoning": "ok"}'), recorded).judge(CTX);

    const body: unknown = JSON.parse(String(recorded[0]?.init.body));
    expect(body).toMatchObject({
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: { required: ["chosenCandidateIndex", "reasoning"] },
      },
    });
  });
});
