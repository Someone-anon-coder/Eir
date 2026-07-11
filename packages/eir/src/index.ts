import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// package.json is build-time-controlled, not external input — its shape is a safe assumption.
const { version } = require("../package.json") as { version: string };

export function eirVersion(): string {
  return version;
}

export { test, expect } from "./fixture.js";

/**
 * The public API surface is exactly three things (approach doc Phase 6
 * closing TS tip): `test`, `expect`, and `defineEirConfig` — everything
 * else (scorers, stores, wrapper classes, the policy state machine) is
 * internal, unreachable through `exports` even by a deep import. `EirMode`
 * and `EirConfig` ship as types only, so a user's `eir.config.ts` can be
 * fully typed without importing any runtime internals.
 */
export { defineEirConfig, type EirConfig } from "./config.js";
export type { EirMode } from "./policy/eirMode.js";
