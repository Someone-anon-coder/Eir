import type { MatchAttempt } from "./matcher.js";

/**
 * Per-test record of every heal attempt Eir made — the channel this
 * phase's whole point depends on: "the pipeline's output is recorded, not
 * acted on" (work item 7) means recorded *somewhere a benchmark run can
 * read it back*, not just logged and discarded. Mirrors
 * `FingerprintRecorder`'s narrow-capability shape: `EirLocator` sees only
 * `record`, never the full log or file-writing mechanics.
 */
export interface MatchLogEntry {
  readonly method: string;
  readonly route: string;
  readonly selectorKey: string;
  readonly result: MatchAttempt;
}

export interface MatchRecorder {
  record(entry: MatchLogEntry): void;
}

export class MatchLog implements MatchRecorder {
  readonly #entries: MatchLogEntry[] = [];

  record(entry: MatchLogEntry): void {
    this.#entries.push(entry);
  }

  get entries(): readonly MatchLogEntry[] {
    return this.#entries;
  }
}
