import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEMO_APP_DIR = new URL("../../demo-app", import.meta.url).pathname;
const BASE_URL = "http://localhost:5173";
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;

export interface DevServerHandle {
  stop(): Promise<void>;
}

async function isUp(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function waitUntilUp(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Ward's dev server exited early with code ${String(child.exitCode)}`);
    }
    if (await isUp()) return;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(`Ward's dev server did not respond at ${BASE_URL} within ${READY_TIMEOUT_MS}ms`);
}

/**
 * Starts Ward's Vite dev server as a child process with `mutationsJson` (or
 * `undefined` for the control run) set as `VITE_EIR_MUTATIONS`. A fresh
 * process every call, never reused across control/mutated phases — Vite's
 * `define` bakes the override payload in at server-start time (see
 * `vite.config.ts`'s comment), so a mid-run env change would be invisible
 * to an already-running server.
 */
export async function startDevServer(mutationsJson: string | undefined): Promise<DevServerHandle> {
  const child = spawn("pnpm", ["exec", "vite", "--strictPort"], {
    cwd: DEMO_APP_DIR,
    env: {
      ...process.env,
      VITE_EIR_MUTATIONS: mutationsJson ?? "",
    },
    stdio: "ignore",
  });

  const exitPromise = new Promise<never>((_resolve, reject) => {
    child.once("error", reject);
  });

  await Promise.race([waitUntilUp(child), exitPromise]);

  async function stop(): Promise<void> {
    if (child.exitCode !== null || child.killed) return;
    child.kill("SIGTERM");
    const deadline = Date.now() + 5_000;
    while (child.exitCode === null && Date.now() < deadline) {
      await delay(50);
    }
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }

  return { stop };
}
