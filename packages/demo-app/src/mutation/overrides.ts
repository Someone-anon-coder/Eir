/**
 * Phase 4's mutation surface. Every field here defaults to a plain
 * pass-through of today's value — this module changes nothing about Ward's
 * behavior unless `VITE_EIR_MUTATIONS` is set, which only the benchmark
 * harness ever does (see packages/benchmark). The reference suite, `pnpm
 * dev`, and CI never set it, so the Phase 2 invisibility proof and every
 * committed fingerprint stay exactly as they were.
 *
 * Deliberately NOT read from `domProfile.ts` directly into the app and test
 * suite alike — a mutated value there would be picked up by both the
 * component *and* any spec that imports `domProfile`, so the "test" would
 * silently track the rename and never observe drift. The harness's probe
 * specs use frozen selector literals instead of importing `domProfile`,
 * exactly simulating a real suite that has no way to know the frontend
 * renamed something out from under it.
 */

export interface MutationPayload {
  readonly attrs: Readonly<Record<string, string>>;
  readonly text: Readonly<Record<string, string>>;
  readonly tags: Readonly<Record<string, "button" | "a">>;
  readonly wrap: readonly string[];
  readonly order: Readonly<Record<string, readonly number[]>>;
}

export const EMPTY_PAYLOAD: MutationPayload = {
  attrs: {},
  text: {},
  tags: {},
  wrap: [],
  order: {},
};

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function isTagRecord(value: unknown): value is Record<string, "button" | "a"> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => entry === "button" || entry === "a")
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOrderRecord(value: unknown): value is Record<string, readonly number[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((n) => typeof n === "number"),
    )
  );
}

export function isMutationPayload(value: unknown): value is MutationPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate["attrs"] === undefined || isStringRecord(candidate["attrs"])) &&
    (candidate["text"] === undefined || isStringRecord(candidate["text"])) &&
    (candidate["tags"] === undefined || isTagRecord(candidate["tags"])) &&
    (candidate["wrap"] === undefined || isStringArray(candidate["wrap"])) &&
    (candidate["order"] === undefined || isOrderRecord(candidate["order"]))
  );
}

export function parseMutationPayload(raw: string | undefined): MutationPayload {
  if (raw === undefined || raw.length === 0) return EMPTY_PAYLOAD;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return EMPTY_PAYLOAD;
  }
  if (!isMutationPayload(parsed)) return EMPTY_PAYLOAD;
  return {
    attrs: parsed.attrs ?? {},
    text: parsed.text ?? {},
    tags: parsed.tags ?? {},
    wrap: parsed.wrap ?? [],
    order: parsed.order ?? {},
  };
}

/**
 * `domProfile.ts` (which calls `overrideAttr` below) is imported from two
 * very different runtimes: the browser bundle Vite builds for Ward itself,
 * where `import.meta.env` is real and populated — and, directly, by
 * Playwright spec files running under Node, where nothing ever ran Vite's
 * transform and `import.meta.env` is simply absent. Reading it without a
 * guard crashes every Node-side `import domProfile` on module load. Optional
 * chaining here means: real env in the browser, always-empty (i.e.
 * always-fallback) in Node — which is a happy accident, not a workaround:
 * a Node-side import of `domProfile` should see the original, unmutated
 * values regardless, exactly like the frozen-literal probe selectors do.
 */
function readMutationsEnvVar(): string | undefined {
  // Dot notation, not bracket notation: `vite.config.ts`'s `define` performs
  // a static textual replacement keyed on this exact property-access chain
  // (esbuild's `define`, not a real runtime env lookup) — bracket notation
  // wouldn't be recognized as the same identifier and would silently stay
  // unreplaced. `import.meta.env` itself is `undefined` in Node (Playwright
  // spec files import `domProfile` directly without going through Vite),
  // hence the optional chain rather than a direct property read.
  const raw = (import.meta as ImportMeta & { env?: { VITE_EIR_MUTATIONS?: unknown } }).env
    ?.VITE_EIR_MUTATIONS;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

const payload: MutationPayload = parseMutationPayload(readMutationsEnvVar());

export function overrideAttr(key: string, fallback: string): string {
  return payload.attrs[key] ?? fallback;
}

export function overrideText(key: string, fallback: string): string {
  return payload.text[key] ?? fallback;
}

export function overrideTag(key: string, fallback: "button" | "a"): "button" | "a" {
  return payload.tags[key] ?? fallback;
}

export function isWrapped(key: string): boolean {
  return payload.wrap.includes(key);
}

export function overrideOrder<T>(key: string, items: readonly T[]): readonly T[] {
  const order = payload.order[key];
  if (order === undefined) return items;
  const reordered: T[] = [];
  for (const index of order) {
    const item = items[index];
    if (item !== undefined) reordered.push(item);
  }
  return reordered;
}
