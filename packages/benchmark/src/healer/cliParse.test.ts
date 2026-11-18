import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseClaudeStream } from "./cliParse.js";

const REAL = readFileSync(
  new URL("./fixtures/healer-smoke-success.jsonl", import.meta.url),
  "utf-8",
);

describe("parseClaudeStream on the real smoke-run output", () => {
  const parsed = parseClaudeStream(REAL);
  if (!parsed.ok) throw new Error(`fixture should parse: ${parsed.reason}`);
  const run = parsed.run;

  it("reads the values the CLI printed", () => {
    expect(run.cliVersion).toBe("2.1.318");
    expect(run.model).toBe("claude-sonnet-5-5");
    expect(run.turns).toBe(5);
    expect(run.costUsd).toBeCloseTo(0.0492923, 7);
    expect(run.durationMs).toBe(41265);
    expect(run.terminalReason).toBe("completed");
    expect(run.isError).toBe(false);
    expect(run.permissionDenials).toBe(0);
    expect(run.mcpConnected).toBe(true);
  });

  it("keeps the three input-token figures separate", () => {
    expect(run.usage).toEqual({ input: 8, output: 708, cacheRead: 24389, cacheCreation: 9908 });
  });

  it("lists every model in the CLI's usage breakdown, including the helper model", () => {
    expect([...run.modelsInUsage].sort()).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5"]);
  });

  it("records the agent's tool calls in order", () => {
    expect(run.toolCalls).toEqual([
      "mcp__playwright-test__test_run",
      "Read",
      "Edit",
      "mcp__playwright-test__test_run",
    ]);
  });

  it("counts assistant events (the harness's turn-cap signal)", () => {
    expect(run.assistantEvents).toBeGreaterThanOrEqual(run.toolCalls.length);
  });
});

describe("parseClaudeStream failure handling (variants derived from the real stream)", () => {
  const lines = REAL.trim().split("\n");

  it("no result event: a truncated stream is a parse failure, with partial data kept", () => {
    const truncated = lines.filter((l) => !l.includes('"type":"result"')).join("\n");
    const parsed = parseClaudeStream(truncated);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toContain("no result event");
      expect(parsed.partial.assistantEvents).toBeGreaterThan(0);
    }
  });

  it("a result missing its cost is a parse failure, never a zero", () => {
    const stripped = lines.map((l) =>
      l.includes('"type":"result"') ? l.replace('"total_cost_usd"', '"renamed_cost"') : l,
    );
    const parsed = parseClaudeStream(stripped.join("\n"));
    expect(parsed.ok).toBe(false);
  });

  it("is_error is surfaced", () => {
    const flipped = lines.map((l) =>
      l.includes('"type":"result"') ? l.replace('"is_error":false', '"is_error":true') : l,
    );
    const parsed = parseClaudeStream(flipped.join("\n"));
    expect(parsed.ok && parsed.run.isError).toBe(true);
  });

  it("tolerates garbage lines between events", () => {
    const parsed = parseClaudeStream(`not json\n${REAL}\n{broken`);
    expect(parsed.ok).toBe(true);
  });

  it("empty input", () => {
    expect(parseClaudeStream("").ok).toBe(false);
  });
});
