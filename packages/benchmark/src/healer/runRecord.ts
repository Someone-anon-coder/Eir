import type { HealerOutcome } from "./classify.js";
import type { TokenUsage } from "./cliParse.js";
import type { Tool } from "./resume.js";
import type { TamperFinding } from "./tamper.js";

/** One JSON per (tool, target, run). Everything the report and docs quote is derived from these. */
export interface HealerDetail {
  readonly model: string | undefined;
  readonly modelsInUsage: readonly string[];
  readonly cliVersion: string | undefined;
  readonly turns: number;
  readonly assistantEvents: number;
  /** CLI-reported, never computed from tokens. `undefined` when the CLI printed no result (killed at the turn cap, crashed). */
  readonly costUsd: number | undefined;
  readonly wallMs: number;
  readonly durationMs: number | undefined;
  readonly apiDurationMs: number | undefined;
  readonly usage: TokenUsage | undefined;
  readonly stoppedBy: string;
  readonly terminalReason: string | undefined;
  readonly permissionDenials: number;
  readonly rateLimitStatuses: readonly string[];
  readonly toolCalls: readonly string[];
  readonly linesAdded: number;
  readonly linesRemoved: number;
  /** The target step's final locator expression(s), one level of `const` resolved. */
  readonly finalLocators: readonly string[];
  readonly tamper: readonly TamperFinding[];
  readonly editedOutside: readonly string[];
  /** Comments present in the final spec but not the original (a `fixme` comment names the cause here). */
  readonly newComments: readonly string[];
  readonly transcriptFile: string | undefined;
  readonly finalSpecFile: string | undefined;
}

export interface EirDetail {
  readonly passed: boolean;
  readonly policyKind: string;
  readonly subReason: string | undefined;
  readonly wallMs: number;
  readonly falseGreen: boolean;
}

export interface RunRecord {
  readonly schema: 1;
  readonly tool: Tool;
  readonly targetId: string;
  readonly mutationClass: string;
  readonly run: number;
  readonly seed: number;
  readonly expectation: "heal" | "stay-red";
  readonly startedAt: string;
  readonly outcome: HealerOutcome;
  /** `out-of-bounds`: what the spec itself would have been. */
  readonly specOutcome: HealerOutcome | undefined;
  readonly reasons: readonly string[];
  readonly actedOn: readonly string[];
  /** infra-error runs are excluded from rates; this records whether a retry was already spent. */
  readonly retried: boolean;
  /** Set only by a recorded human verdict on a `needs-human-review` run. */
  readonly adjudicated: boolean;
  readonly healer: HealerDetail | undefined;
  readonly eir: EirDetail | undefined;
}
