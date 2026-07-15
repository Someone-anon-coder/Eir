import type { FallbackJudgement, FallbackProvider } from "./provider.js";
import type { FallbackContext, ProviderVerdict } from "./verdict.js";

/**
 * The offline half of the provider seam: returns scripted verdicts in
 * order (then `no-verdict` forever), records every context it was shown,
 * and never touches the network. The entire unit suite — and any CI run —
 * exercises the fallback system through this class; `GeminiProvider` is
 * only ever constructed when a user has explicitly enabled the fallback
 * *and* supplied a key (see `runFallback.ts`).
 */
export class NullProvider implements FallbackProvider {
  readonly name = "null";
  readonly judged: FallbackContext[] = [];
  readonly #scripted: ProviderVerdict[];

  constructor(scripted: readonly ProviderVerdict[] = []) {
    this.#scripted = [...scripted];
  }

  judge(ctx: FallbackContext): Promise<FallbackJudgement> {
    this.judged.push(ctx);
    const verdict = this.#scripted.shift() ?? {
      kind: "no-verdict" as const,
      reason: "null-provider",
    };
    return Promise.resolve({ verdict, meta: null });
  }
}
