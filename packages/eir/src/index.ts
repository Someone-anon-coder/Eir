import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// package.json is build-time-controlled, not external input — its shape is a safe assumption.
const { version } = require("../package.json") as { version: string };

export function eirVersion(): string {
  return version;
}
