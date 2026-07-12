import { readFile } from "node:fs/promises";
import type { ReportedMode } from "./renderComment.js";

export interface GithubContext {
  readonly owner: string;
  readonly repo: string;
  readonly apiUrl: string;
  readonly token: string;
  readonly prNumber: number;
}

export class MissingContextError extends Error {}

async function prNumberFromEventPayload(eventPath: string | undefined): Promise<number | null> {
  if (eventPath === undefined || eventPath.length === 0) return null;
  try {
    const text = await readFile(eventPath, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    const pullRequest = (parsed as Record<string, unknown>)["pull_request"];
    if (typeof pullRequest !== "object" || pullRequest === null) return null;
    const number = (pullRequest as Record<string, unknown>)["number"];
    return typeof number === "number" ? number : null;
  } catch {
    return null;
  }
}

function readInput(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[`INPUT_${name.toUpperCase()}`];
  return value === undefined || value.length === 0 ? undefined : value;
}

/**
 * Every fact here comes from the environment GitHub Actions already
 * populates, plus the action's own declared inputs (`action.yml`) — never
 * guessed. `GITHUB_TOKEN` is not set automatically; the workflow must
 * pass it in as the `github-token` input (`${{ github.token }}` is the
 * usual value — see the token/permission Understanding Gate).
 */
export async function resolveGithubContext(env: NodeJS.ProcessEnv): Promise<GithubContext> {
  const repository = env["GITHUB_REPOSITORY"];
  if (repository === undefined) {
    throw new MissingContextError(
      "GITHUB_REPOSITORY is not set — this action must run inside GitHub Actions",
    );
  }
  const [owner, repo] = repository.split("/");
  if (owner === undefined || repo === undefined) {
    throw new MissingContextError(`GITHUB_REPOSITORY has an unexpected shape: "${repository}"`);
  }

  const token = readInput(env, "github-token") ?? env["GITHUB_TOKEN"];
  if (token === undefined) {
    throw new MissingContextError(
      "no GitHub token available — pass the `github-token` input (e.g. `${{ github.token }}`)",
    );
  }

  const overridePrNumber = readInput(env, "pr-number");
  const prNumber =
    overridePrNumber !== undefined
      ? Number(overridePrNumber)
      : await prNumberFromEventPayload(env["GITHUB_EVENT_PATH"]);
  if (prNumber === null || prNumber === undefined || Number.isNaN(prNumber)) {
    throw new MissingContextError(
      "could not determine a pull request number — this action only runs on `pull_request` events, or pass the `pr-number` input explicitly",
    );
  }

  return {
    owner,
    repo,
    apiUrl: env["GITHUB_API_URL"] ?? "https://api.github.com",
    token,
    prNumber,
  };
}

export interface ActionInputs {
  readonly reportPath: string;
  readonly mode: ReportedMode;
  readonly docsUrl: string;
}

const KNOWN_MODES: ReadonlySet<string> = new Set(["suggest-only", "heal", "unknown"]);

function parseMode(raw: string | undefined): ReportedMode {
  if (raw !== undefined && KNOWN_MODES.has(raw)) return raw as ReportedMode;
  return "unknown";
}

export function resolveActionInputs(env: NodeJS.ProcessEnv): ActionInputs {
  return {
    reportPath: readInput(env, "report-path") ?? "eir-report/eir-report.json",
    mode: parseMode(readInput(env, "mode")),
    docsUrl:
      readInput(env, "docs-url") ??
      "https://github.com/Someone-anon-coder/Eir/blob/main/docs/ci.md",
  };
}
