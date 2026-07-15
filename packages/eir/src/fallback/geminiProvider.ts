import { z } from "zod";
import { buildFallbackPrompt } from "./prompt.js";
import type { FallbackJudgement, FallbackProvider } from "./provider.js";
import { WireVerdictSchema, type FallbackContext, type ProviderVerdict } from "./verdict.js";

/**
 * Default model, proposed at this phase's Cost Gate: a current,
 * cheap, low-latency model suited to structured-output classification —
 * this call is a constrained "pick one of N or none" judgement, not
 * generation, so the smallest current Flash-family model is the honest
 * fit. Overridable via `fallback.model` in `EirConfig`.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * The envelope Gemini's `generateContent` REST endpoint wraps replies in.
 * Validated with the same rigor as the verdict itself — the envelope is
 * boundary data too. Token counts are optional throughout: absent usage
 * metadata degrades to `null` in the meta, never to a crash.
 */
const ResponseEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
    })
    .optional(),
});

export interface GeminiProviderOptions {
  /** Read from the configured env var by `runFallback.ts` — never from a file, never logged, sent only as the `x-goog-api-key` header (never in the URL, so it cannot leak into request logs). */
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs?: number;
  /** Test seam: the unit suite injects a fake; production uses global `fetch`. */
  readonly fetchFn?: typeof fetch;
}

/**
 * The real half of the provider seam. `judge` never throws (see
 * `FallbackProvider`'s contract): every failure mode is mapped to a
 * `no-verdict` with a diagnosable reason string. Reason strings are built
 * only from status codes, zod issue paths, and fixed labels — never from
 * request data — so no output of this class can contain the API key.
 */
export class GeminiProvider implements FallbackProvider {
  readonly name = "gemini";
  readonly #options: GeminiProviderOptions;

  constructor(options: GeminiProviderOptions) {
    this.#options = options;
  }

  async judge(ctx: FallbackContext): Promise<FallbackJudgement> {
    const started = performance.now();
    const fetchFn = this.#options.fetchFn ?? fetch;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.#options.model}:generateContent`;

    const body = {
      contents: [{ role: "user", parts: [{ text: buildFallbackPrompt(ctx) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            chosenCandidateIndex: { type: "INTEGER", nullable: true },
            reasoning: { type: "STRING" },
          },
          required: ["chosenCandidateIndex", "reasoning"],
        },
      },
    };

    let response: Response;
    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.#options.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network-error";
      return this.#noVerdict(reason, started);
    }

    if (!response.ok) {
      return this.#noVerdict(`http-${response.status}`, started);
    }

    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      return this.#noVerdict("response-not-json", started);
    }

    const parsedEnvelope = ResponseEnvelopeSchema.safeParse(envelope);
    if (!parsedEnvelope.success) {
      return this.#noVerdict("envelope-schema-invalid", started);
    }

    const usage = parsedEnvelope.data.usageMetadata;
    const meta = {
      latencyMs: performance.now() - started,
      inputTokens: usage?.promptTokenCount ?? null,
      outputTokens:
        usage?.candidatesTokenCount === undefined
          ? null
          : usage.candidatesTokenCount + (usage.thoughtsTokenCount ?? 0),
    };

    const text = (parsedEnvelope.data.candidates[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");
    if (text.length === 0) {
      return { verdict: { kind: "no-verdict", reason: "empty-reply" }, meta };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { verdict: { kind: "no-verdict", reason: "verdict-not-json" }, meta };
    }

    const parsed = WireVerdictSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.path.join(".") || "(root)").join(",");
      return { verdict: { kind: "no-verdict", reason: `verdict-schema-invalid:${issues}` }, meta };
    }

    const verdict: ProviderVerdict =
      parsed.data.chosenCandidateIndex === null
        ? { kind: "none-of-them", reasoning: parsed.data.reasoning }
        : {
            kind: "chose",
            candidateIndex: parsed.data.chosenCandidateIndex,
            reasoning: parsed.data.reasoning,
          };
    return { verdict, meta };
  }

  #noVerdict(reason: string, started: number): FallbackJudgement {
    return {
      verdict: { kind: "no-verdict", reason },
      meta: { latencyMs: performance.now() - started, inputTokens: null, outputTokens: null },
    };
  }
}
