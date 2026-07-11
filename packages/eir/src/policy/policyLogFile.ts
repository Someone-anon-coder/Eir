import { appendFile } from "node:fs/promises";
import type { PolicyEvent } from "./policyLog.js";

/**
 * Opt-in JSONL sink, mirroring `matching/matchLogFile.ts` exactly: no-op
 * unless `EIR_POLICY_LOG_FILE` is set (only `packages/benchmark`'s
 * dual-mode harness sets it), zero footprint for every real user.
 * Screenshots are written as base64 rather than left as raw `Buffer`s —
 * JSONL has no binary type.
 */
export interface PolicyLogLine {
  readonly testTitle: string;
  readonly events: readonly SerializedPolicyEvent[];
}

export type SerializedPolicyEvent =
  | (Omit<Extract<PolicyEvent, { kind: "heal-attempt" }>, "screenshot"> & {
      readonly screenshotBase64: string | null;
    })
  | Extract<PolicyEvent, { kind: "drift-suspected" }>;

export function serializeEvent(event: PolicyEvent): SerializedPolicyEvent {
  if (event.kind === "drift-suspected") return event;
  const { screenshot, ...rest } = event;
  return { ...rest, screenshotBase64: screenshot === null ? null : screenshot.toString("base64") };
}

export async function appendPolicyLogFile(
  testTitle: string,
  events: readonly PolicyEvent[],
): Promise<void> {
  const filePath = process.env["EIR_POLICY_LOG_FILE"];
  if (filePath === undefined || filePath.length === 0) return;
  if (events.length === 0) return;

  const line: PolicyLogLine = { testTitle, events: events.map(serializeEvent) };
  await appendFile(filePath, `${JSON.stringify(line)}\n`, "utf8");
}
