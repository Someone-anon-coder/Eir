import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEMO_APP_DIR = new URL("../../demo-app", import.meta.url).pathname;
const BASE_URL = "http://localhost:5173";
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 200;
const STOP_TIMEOUT_MS = 5_000;

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
 * `pnpm exec vite` does not replace itself via `execve` on this system —
 * it forks `vite`'s own dev server as a *grandchild*, so `child.kill()`
 * only ever signals the `pnpm` wrapper, not the actual process holding
 * port 5173. Discovered live: a full `--all` benchmark run produced
 * wildly inconsistent per-class numbers (several classes showing
 * `mutation-ineffective` for every target) with no error anywhere —
 * `ps aux` after a "clean" run showed orphaned `vite.js` processes still
 * bound to the port, serving whichever mutation payload (or none) they'd
 * been started with, indistinguishable from a real server until you
 * inspect the process tree. `detached: true` puts the whole pnpm→vite
 * tree in its own process group (group id == the spawned pid); killing
 * the *group* (`process.kill(-pid, signal)`, the POSIX negative-pid
 * convention) reaches every descendant, not just the direct child.
 */
async function killProcessGroup(pid: number, signal: NodeJS.Signals): Promise<void> {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    // ESRCH: the group is already gone — stop() may be called after the
    // process exited on its own. Anything else is a real problem.
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/**
 * Starts Ward's Vite dev server as a child process with `mutationsJson` (or
 * `undefined` for the control run) set as `VITE_EIR_MUTATIONS`. A fresh
 * process every call, never reused across control/mutated phases — Vite's
 * `define` bakes the override payload in at server-start time (see
 * `vite.config.ts`'s comment), so a mid-run env change would be invisible
 * to an already-running server.
 *
 * `--force` (bypasses Vite's dependency pre-bundling cache on every start):
 * discovered live, the same way as the process-group bug above.
 * `node_modules/.vite`'s cache invalidation has no way to know
 * `VITE_EIR_MUTATIONS` changed between two rapid restarts, so a fresh
 * server can serve a stale, pre-mutation-payload bundle for its first
 * requests — indistinguishable from a genuine "mutation had no effect"
 * result (`mutation-ineffective`) until you clear the cache by hand and
 * watch the same run turn correct. `--force` costs a slightly slower
 * cold start every time in exchange for never hitting this silently.
 */
export async function startDevServer(mutationsJson: string | undefined): Promise<DevServerHandle> {
  const child = spawn("pnpm", ["exec", "vite", "--strictPort", "--force"], {
    cwd: DEMO_APP_DIR,
    env: {
      ...process.env,
      VITE_EIR_MUTATIONS: mutationsJson ?? "",
    },
    stdio: "ignore",
    detached: true,
  });

  // A single-expression guard (rather than a separate `if` block) so
  // TypeScript narrows `pid` to `number` for the rest of this function,
  // including inside the `stop` closure defined below.
  const pid: number =
    child.pid ??
    (() => {
      throw new Error("Failed to spawn Ward's dev server: no pid (spawn itself failed synchronously)");
    })();

  const exitPromise = new Promise<never>((_resolve, reject) => {
    child.once("error", reject);
  });

  await Promise.race([waitUntilUp(child), exitPromise]);

  async function stop(): Promise<void> {
    if (child.exitCode === null && !child.killed) {
      await killProcessGroup(pid, "SIGTERM");
      const killDeadline = Date.now() + STOP_TIMEOUT_MS;
      while (child.exitCode === null && Date.now() < killDeadline) {
        await delay(50);
      }
      if (child.exitCode === null) {
        await killProcessGroup(pid, "SIGKILL");
      }
    }

    // Belt and braces: don't hand control back to the caller (who is
    // about to start a *new* server on this exact port) until the OS has
    // actually released it — the process exiting and the port becoming
    // free are not quite the same instant.
    const portDeadline = Date.now() + STOP_TIMEOUT_MS;
    while ((await isUp()) && Date.now() < portDeadline) {
      await delay(50);
    }
  }

  return { stop };
}
