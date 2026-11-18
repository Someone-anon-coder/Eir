/**
 * Judge-only ground-truth markers for the healer comparison
 * (docs/healer-comparison.md). Entirely opt-in: with neither flag set,
 * `gt()` returns `{}` — spreading it onto an element adds no attribute —
 * and `installGtCollector()` registers nothing, so Ward renders exactly
 * what it rendered before this module existed.
 *
 * The marker value is an *element key* (`<area>.<element>`), not a target
 * id: one element is the target of several mutation classes. A near-
 * duplicate twin needs no separate decoy attribute — it carries its own
 * element key, and the judge knows which key is the target and which is
 * the decoy.
 *
 * Eir cannot see the marker: `data-eir-gt` is outside the fingerprint
 * allow-list (packages/eir/src/capture/attrsFilter.ts), so the benchmark's
 * own 8-class table is the proof that a marked build behaves identically.
 */

interface GtEnv {
  VITE_EIR_GT_MARKERS?: unknown;
  VITE_EIR_GT_COLLECTOR?: unknown;
}

function readEnv(): GtEnv {
  // Dot-notation reads so vite.config.ts's `define` can replace them; same
  // reasoning as `readMutationsEnvVar` in overrides.ts.
  const env = (import.meta as ImportMeta & { env?: GtEnv }).env;
  return {
    VITE_EIR_GT_MARKERS: env?.VITE_EIR_GT_MARKERS,
    VITE_EIR_GT_COLLECTOR: env?.VITE_EIR_GT_COLLECTOR,
  };
}

const MARKERS_ON = readEnv().VITE_EIR_GT_MARKERS === "1";

export function gt(element: string): Record<string, string> {
  return MARKERS_ON ? { "data-eir-gt": element } : {};
}

/** Event types a test step uses to "act on" an element. */
const ACTED_ON_EVENTS = ["click", "input", "change"] as const;

/**
 * Reports each user-level event whose target sits inside a marked element
 * to a collector the judge runs, so the judge learns which element a final
 * spec really acted on, whatever locator the spec used to get there.
 */
export function installGtCollector(): void {
  const { VITE_EIR_GT_COLLECTOR: collector } = readEnv();
  if (!MARKERS_ON || typeof collector !== "string" || collector.length === 0) return;
  for (const type of ACTED_ON_EVENTS) {
    document.addEventListener(
      type,
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const marked = target.closest("[data-eir-gt]");
        const element = marked?.getAttribute("data-eir-gt");
        if (element === null || element === undefined) return;
        void fetch(collector, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          body: JSON.stringify({ type, element }),
        }).catch(() => {});
      },
      true,
    );
  }
}
