import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// package.json is build-time-controlled, not external input — its shape is a safe assumption.
const { version } = require("../package.json") as { version: string };

export function eirVersion(): string {
  return version;
}

export { test, expect } from "./fixture.js";

/**
 * The public runtime API is `test`, `expect`, `defineEirConfig`, and
 * `eirVersion` (approach doc Phase 6 closing TS tip named the first three;
 * `eirVersion` is the fourth, used by adopters to confirm which release a
 * CI run or bug report came from) — everything else (scorers, stores,
 * wrapper classes, the policy state machine) is internal, unreachable
 * through `exports` even by a deep import. `EirMode` and `EirConfig` ship
 * as types only, so a user's `eir.config.ts` can be fully typed without
 * importing any runtime internals.
 */
export { defineEirConfig, type EirConfig } from "./config.js";
export type { EirMode } from "./policy/eirMode.js";
