import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { turnCapReached } from "./budget.js";
import { parseClaudeStream, type ParseResult } from "./cliParse.js";
import { locatePlaywright } from "./workspace.js";

/**
 * Playwright's own heal prompt, read from the installed package so the
 * wording is whatever 1.65.1 ships ("Run all my tests and fix the failing
 * ones."), not a copy that could drift.
 */
export async function readHealPrompt(): Promise<string> {
  const file = path.join(
    locatePlaywright().playwrightDir,
    "lib",
    "agents",
    "playwright-test-heal.prompt.md",
  );
  const text = await readFile(file, "utf-8");
  return text.replace(/^---[\s\S]*?---\s*/, "").trim();
}

/** Verified against Claude Code 2.1.318 by the smoke run (NOTES.md, 2026-11-18). */
export function healerArgs(prompt: string, maxBudgetUsd: number): string[] {
  return [
    "-p",
    prompt,
    "--agent",
    "playwright-test-healer",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "mcp__playwright-test__*",
    "--strict-mcp-config",
    "--mcp-config",
    ".mcp.json",
    "--setting-sources",
    "project",
    "--no-session-persistence",
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];
}

export interface HealerRunOptions {
  readonly workspace: string;
  readonly prompt: string;
  readonly transcriptFile: string;
  readonly maxTurns: number;
  readonly maxBudgetUsd: number;
  readonly wallTimeoutMs: number;
}

export interface HealerRunResult {
  readonly parsed: ParseResult;
  readonly killedFor: "max-turns" | "timeout" | undefined;
  readonly exitCode: number | null;
  readonly wallMs: number;
}

export async function runHealerAgent(options: HealerRunOptions): Promise<HealerRunResult> {
  await mkdir(path.dirname(options.transcriptFile), { recursive: true });
  const transcript = createWriteStream(options.transcriptFile);
  const started = Date.now();
  const child = spawn("claude", healerArgs(options.prompt, options.maxBudgetUsd), {
    cwd: options.workspace,
    env: process.env,
    stdio: ["ignore", "pipe", "ignore"],
    detached: true,
  });

  let buffer = "";
  let assistantEvents = 0;
  let killedFor: "max-turns" | "timeout" | undefined;
  const kill = (reason: "max-turns" | "timeout"): void => {
    if (killedFor !== undefined) return;
    killedFor = reason;
    try {
      if (child.pid !== undefined) process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  const timer = setTimeout(() => kill("timeout"), options.wallTimeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    transcript.write(chunk);
    buffer += chunk.toString("utf-8");
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.includes('"type":"assistant"')) {
        assistantEvents++;
        if (turnCapReached(assistantEvents, options.maxTurns)) kill("max-turns");
      }
      newline = buffer.indexOf("\n");
    }
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.once("error", () => resolve(null));
    child.once("exit", (code) => resolve(code));
  });
  clearTimeout(timer);
  await new Promise<void>((resolve) => transcript.end(resolve));
  const text = await readFile(options.transcriptFile, "utf-8");
  return { parsed: parseClaudeStream(text), killedFor, exitCode, wallMs: Date.now() - started };
}
