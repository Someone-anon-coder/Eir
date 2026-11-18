/**
 * Reads which element each interaction hit from a Playwright trace
 * (`*-trace.trace` NDJSON), independently of the judge's collector. Playwright
 * marks each action's target node in its frame snapshot with a
 * `__playwright_target__` attribute; on a marked build that node (or an
 * ancestor) carries our `data-eir-gt` key.
 */

export const INTERACTION_METHODS: ReadonlySet<string> = new Set([
  "click",
  "dblclick",
  "fill",
  "selectOption",
  "check",
  "uncheck",
  "press",
  "type",
  "hover",
  "tap",
  "setInputFiles",
  "dispatchEvent",
]);

export interface TracedAction {
  readonly callId: string;
  readonly method: string;
  readonly tag: string;
  /** The target's own marker, if it has one. */
  readonly ownMarker: string | undefined;
  /** Nearest marked element at or above the target (the collector's notion of "acted on"). */
  readonly nearestMarker: string | undefined;
  /** Every marked ancestor, nearest first. */
  readonly markedAncestors: readonly string[];
}

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

interface Found {
  readonly tag: string;
  readonly marker: string | undefined;
  readonly ancestors: readonly string[];
}

/** Snapshot nodes are `[TAG, {attrs}, ...children]`; unchanged subtrees are back-references and are skipped. */
function findTarget(node: unknown, ancestors: readonly string[]): Found | undefined {
  if (!Array.isArray(node)) return undefined;
  if (typeof node[0] === "string") {
    const attrs = isRecord(node[1]) ? node[1] : {};
    const marker = typeof attrs["data-eir-gt"] === "string" ? attrs["data-eir-gt"] : undefined;
    if ("__playwright_target__" in attrs) return { tag: node[0], marker, ancestors };
    const next = marker === undefined ? ancestors : [marker, ...ancestors];
    for (const child of node.slice(isRecord(node[1]) ? 2 : 1)) {
      const hit = findTarget(child, next);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  for (const child of node) {
    const hit = findTarget(child, ancestors);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

export function parseTraceActions(traceNdjson: string): TracedAction[] {
  const events: Json[] = [];
  for (const line of traceNdjson.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) events.push(parsed);
    } catch {
      // A malformed line is skipped; an action with no readable snapshot simply yields no entry.
    }
  }
  const snapshots = events.flatMap((e) =>
    e["type"] === "frame-snapshot" && isRecord(e["snapshot"]) ? [e["snapshot"]] : [],
  );
  const actions: TracedAction[] = [];
  for (const e of events) {
    if (
      e["type"] !== "before" ||
      typeof e["callId"] !== "string" ||
      typeof e["method"] !== "string"
    )
      continue;
    if (!INTERACTION_METHODS.has(e["method"])) continue;
    const callId = e["callId"];
    // The `action` snapshot is taken at the moment of the interaction; fall back to any snapshot of the call.
    const candidates = snapshots.filter((s) => s["callId"] === callId);
    const ordered = [
      ...candidates.filter((s) => s["phase"] === "action"),
      ...candidates.filter((s) => s["phase"] !== "action"),
    ];
    for (const snap of ordered) {
      const hit = findTarget(snap["html"], []);
      if (hit === undefined) continue;
      const markedAncestors = hit.ancestors;
      actions.push({
        callId,
        method: e["method"],
        tag: hit.tag,
        ownMarker: hit.marker,
        nearestMarker: hit.marker ?? markedAncestors[0],
        markedAncestors,
      });
      break;
    }
  }
  return actions;
}

export interface TraceAgreement {
  readonly agree: boolean;
  readonly traceSet: readonly string[];
  readonly collectorSet: readonly string[];
  readonly onlyInTrace: readonly string[];
  readonly onlyInCollector: readonly string[];
}

/** Does the trace's set of acted-on marked elements equal the collector's? */
export function compareToCollector(
  actions: readonly TracedAction[],
  collector: readonly string[],
  /** `path`: container targets are attributed by every marked ancestor, as the judge does for them. */
  mode: "nearest" | "path" = "nearest",
): TraceAgreement {
  const keysOf = (a: TracedAction): string[] =>
    mode === "path"
      ? [...(a.ownMarker === undefined ? [] : [a.ownMarker]), ...a.markedAncestors]
      : a.nearestMarker === undefined
        ? []
        : [a.nearestMarker];
  const traceSet = [...new Set(actions.flatMap(keysOf))].sort();
  const collectorSet = [...new Set(collector)].sort();
  const onlyInTrace = traceSet.filter((k) => !collectorSet.includes(k));
  const onlyInCollector = collectorSet.filter((k) => !traceSet.includes(k));
  return {
    agree: onlyInTrace.length === 0 && onlyInCollector.length === 0,
    traceSet,
    collectorSet,
    onlyInTrace,
    onlyInCollector,
  };
}
