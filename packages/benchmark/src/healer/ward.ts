import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const DEMO_APP_DIR = new URL("../../../demo-app", import.meta.url).pathname;
const READY_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;

/** Ports the comparison uses. 5173 stays free for the standing benchmark. */
export const PORTS = { blind: 5301, marked: 5302, control: 5303, collector: 5310 } as const;

export function isListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** A stale server silently makes every mutation ineffective, so a busy port is a hard stop. */
export async function assertPortsFree(ports: readonly number[]): Promise<void> {
  for (const port of ports) {
    if (await isListening(port)) {
      throw new Error(
        `Port ${port} is already in use (stale server?). Check with: lsof -i :${port}`,
      );
    }
  }
}

export interface WardOptions {
  readonly port: number;
  readonly mutationsJson?: string;
  /** Renders `data-eir-gt` markers. Only the judge's build ever has this on. */
  readonly markers?: boolean;
  readonly collectorUrl?: string;
}

export interface WardHandle {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

async function killGroup(pid: number, signal: NodeJS.Signals): Promise<void> {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

async function waitUntilUp(child: ChildProcess, port: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Ward on :${port} exited early (code ${String(child.exitCode)})`);
    if (await isListening(port)) return;
    await delay(200);
  }
  throw new Error(`Ward on :${port} did not start within ${READY_TIMEOUT_MS}ms`);
}

/**
 * Same process-group and `--force` reasoning as `devServer.ts` (see its
 * comments), parametrized by port so the blind, marked and control builds
 * can run side by side.
 */
export async function startWard(options: WardOptions): Promise<WardHandle> {
  const { port } = options;
  const child = spawn("pnpm", ["exec", "vite", "--port", String(port), "--strictPort", "--force"], {
    cwd: DEMO_APP_DIR,
    env: {
      ...process.env,
      VITE_EIR_MUTATIONS: options.mutationsJson ?? "",
      VITE_EIR_GT_MARKERS: options.markers === true ? "1" : "",
      VITE_EIR_GT_COLLECTOR: options.collectorUrl ?? "",
    },
    stdio: "ignore",
    detached: true,
  });
  const pid = child.pid;
  if (pid === undefined) throw new Error(`Failed to spawn Ward on :${port}`);
  try {
    await waitUntilUp(child, port);
  } catch (error) {
    await killGroup(pid, "SIGKILL");
    throw error;
  }
  const baseUrl = `http://localhost:${port}`;

  async function stop(): Promise<void> {
    if (child.exitCode === null) {
      await killGroup(pid as number, "SIGTERM");
      const deadline = Date.now() + STOP_TIMEOUT_MS;
      while (child.exitCode === null && Date.now() < deadline) await delay(50);
      if (child.exitCode === null) await killGroup(pid as number, "SIGKILL");
    }
    const portDeadline = Date.now() + STOP_TIMEOUT_MS;
    while ((await isListening(port)) && Date.now() < portDeadline) await delay(50);
  }
  return { baseUrl, stop };
}

/**
 * Proves the server serves what was asked for by reading back the env object
 * Vite prefixes to every transformed module. Vite bakes `define` values at
 * server start, and the existing harness has been bitten by a stale bundle
 * that was indistinguishable from "mutation had no effect".
 */
export async function verifyWard(handle: WardHandle, options: WardOptions): Promise<void> {
  const text = await (await fetch(`${handle.baseUrl}/src/mutation/overrides.ts`)).text();
  const match = /^import\.meta\.env = (\{.*?\});/.exec(text);
  if (match?.[1] === undefined)
    throw new Error(`Ward on :${options.port}: could not read back the served env`);
  const env: unknown = JSON.parse(match[1]);
  const served = (key: string): string => {
    const value =
      typeof env === "object" && env !== null ? (env as Record<string, unknown>)[key] : undefined;
    return typeof value === "string" ? value : "";
  };
  const mismatches: string[] = [];
  if (served("VITE_EIR_MUTATIONS") !== (options.mutationsJson ?? ""))
    mismatches.push("mutation payload");
  if (served("VITE_EIR_GT_MARKERS") !== (options.markers === true ? "1" : ""))
    mismatches.push("marker flag");
  if (served("VITE_EIR_GT_COLLECTOR") !== (options.collectorUrl ?? ""))
    mismatches.push("collector url");
  if (mismatches.length > 0) {
    throw new Error(
      `Ward on :${options.port} is not serving the requested ${mismatches.join(", ")}`,
    );
  }
}

// ---- collector --------------------------------------------------------------

export interface ActedEvent {
  readonly type: string;
  readonly element: string;
  /** Every marked element the event passed through, nearest first. */
  readonly path: readonly string[];
}

export interface Collector {
  readonly url: string;
  reset(): void;
  /** Distinct nearest-marked element keys acted on since the last reset. */
  actedOn(): readonly string[];
  /** Distinct keys of every marked element an event passed through (for container targets). */
  actedOnPaths(): readonly string[];
  stop(): Promise<void>;
}

/** Receives the marked build's "this element was acted on" beacons. Judge-only. */
export async function startCollector(port: number): Promise<Collector> {
  let events: ActedEvent[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        if (typeof parsed === "object" && parsed !== null) {
          const r = parsed as Record<string, unknown>;
          if (typeof r["type"] === "string" && typeof r["element"] === "string") {
            const path = Array.isArray(r["path"])
              ? r["path"].filter((k): k is string => typeof k === "string")
              : [];
            events.push({ type: r["type"], element: r["element"], path });
          }
        }
      } catch {
        // A malformed beacon is dropped: the judge treats "no events" as needs-human-review, never as a pass.
      }
      res.writeHead(204, { "access-control-allow-origin": "*" });
      res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${port}/`,
    reset: () => {
      events = [];
    },
    actedOn: () => [...new Set(events.map((e) => e.element))],
    actedOnPaths: () => [...new Set(events.flatMap((e) => e.path))],
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
