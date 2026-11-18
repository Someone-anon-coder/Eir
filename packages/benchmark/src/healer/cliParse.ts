/**
 * Parses `claude -p --output-format stream-json --verbose` output. Every
 * field enters as `unknown` and is narrowed here: the CLI's stream format is
 * not a contract this project owns, so a missing or renamed field must show
 * up as a parse failure (an `infra-error`), never as a silently wrong
 * number. Cost is CLI-reported and never recomputed from tokens.
 */

export interface TokenUsage {
  /** Uncached input tokens. The CLI splits input three ways; there is no single "total input" figure. */
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheCreation: number;
}

export interface ParsedRun {
  readonly cliVersion: string | undefined;
  /** Model of the agent's own turns, as seen on its assistant events. */
  readonly model: string | undefined;
  /** Every model that appears in the CLI's own usage breakdown (it can include a small helper model). */
  readonly modelsInUsage: readonly string[];
  readonly turns: number;
  readonly assistantEvents: number;
  readonly costUsd: number;
  readonly durationMs: number;
  readonly apiDurationMs: number;
  readonly usage: TokenUsage;
  readonly terminalReason: string | undefined;
  readonly stopReason: string | undefined;
  readonly isError: boolean;
  readonly permissionDenials: number;
  readonly mcpConnected: boolean;
  /** Worst rate-limit status seen (`allowed` is fine; anything else is worth reporting). */
  readonly rateLimitStatuses: readonly string[];
  readonly toolCalls: readonly string[];
}

export type ParseResult =
  | { readonly ok: true; readonly run: ParsedRun }
  | { readonly ok: false; readonly reason: string; readonly partial: Partial<ParsedRun> };

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

function parseLines(text: string): { events: Json[]; badLines: number } {
  const events: Json[] = [];
  let badLines = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isRecord(parsed)) events.push(parsed);
      else badLines++;
    } catch {
      badLines++;
    }
  }
  return { events, badLines };
}

function readUsage(value: unknown): TokenUsage | undefined {
  if (!isRecord(value)) return undefined;
  const input = num(value["input_tokens"]);
  const output = num(value["output_tokens"]);
  if (input === undefined || output === undefined) return undefined;
  return {
    input,
    output,
    cacheRead: num(value["cache_read_input_tokens"]) ?? 0,
    cacheCreation: num(value["cache_creation_input_tokens"]) ?? 0,
  };
}

export function parseClaudeStream(text: string): ParseResult {
  const { events } = parseLines(text);
  let cliVersion: string | undefined;
  let mcpConnected = false;
  let assistantEvents = 0;
  let model: string | undefined;
  const rateLimitStatuses: string[] = [];
  const toolCalls: string[] = [];
  let result: Json | undefined;

  for (const event of events) {
    const type = str(event["type"]);
    if (type === "system" && str(event["subtype"]) === "init") {
      cliVersion = str(event["claude_code_version"]);
      const servers = event["mcp_servers"];
      mcpConnected =
        Array.isArray(servers) && servers.some((s) => isRecord(s) && s["status"] === "connected");
    } else if (type === "assistant" && isRecord(event["message"])) {
      assistantEvents++;
      model ??= str(event["message"]["model"]);
      const content = event["message"]["content"];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (isRecord(block) && block["type"] === "tool_use") {
            const name = str(block["name"]);
            if (name !== undefined) toolCalls.push(name);
          }
        }
      }
    } else if (type === "rate_limit_event" && isRecord(event["rate_limit_info"])) {
      const status = str(event["rate_limit_info"]["status"]);
      if (status !== undefined) rateLimitStatuses.push(status);
    } else if (type === "result") {
      result = event;
    }
  }

  const partial: Partial<ParsedRun> = {
    cliVersion,
    model,
    assistantEvents,
    mcpConnected,
    toolCalls,
    rateLimitStatuses,
  };
  if (result === undefined) {
    return { ok: false, reason: "no result event (truncated or crashed stream)", partial };
  }

  const costUsd = num(result["total_cost_usd"]);
  const turns = num(result["num_turns"]);
  const durationMs = num(result["duration_ms"]);
  const usage = readUsage(result["usage"]);
  if (
    costUsd === undefined ||
    turns === undefined ||
    durationMs === undefined ||
    usage === undefined
  ) {
    return { ok: false, reason: "result event is missing cost, turns, duration or usage", partial };
  }
  const modelUsage = result["modelUsage"];
  return {
    ok: true,
    run: {
      cliVersion,
      model,
      modelsInUsage: isRecord(modelUsage) ? Object.keys(modelUsage) : [],
      turns,
      assistantEvents,
      costUsd,
      durationMs,
      apiDurationMs: num(result["duration_api_ms"]) ?? 0,
      usage,
      terminalReason: str(result["terminal_reason"]),
      stopReason: str(result["stop_reason"]),
      isError: result["is_error"] === true,
      permissionDenials: Array.isArray(result["permission_denials"])
        ? result["permission_denials"].length
        : 0,
      mcpConnected,
      rateLimitStatuses,
      toolCalls,
    },
  };
}
