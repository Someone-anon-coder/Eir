import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

/** Gitignored scratch root for the template, Eir stores, raw run records and transcripts. */
export const HEALER_ROOT = new URL("../../.healer", import.meta.url).pathname;

export interface PlaywrightLocation {
  readonly testPackageDir: string;
  readonly playwrightDir: string;
  readonly version: string;
}

export function locatePlaywright(): PlaywrightLocation {
  const pkgJson = realpathSync(require.resolve("@playwright/test/package.json"));
  const testPackageDir = path.dirname(pkgJson);
  const playwrightDir = path.resolve(testPackageDir, "../../playwright");
  const manifest: unknown = JSON.parse(readFileSync(pkgJson, "utf-8"));
  const rawVersion =
    typeof manifest === "object" && manifest !== null
      ? Reflect.get(manifest, "version")
      : undefined;
  const version = typeof rawVersion === "string" ? rawVersion : "unknown";
  return { testPackageDir, playwrightDir, version };
}

/** `"type": "module"` is a documented prerequisite of playwright-eir (ESM-only), so every workspace has it, keeping both tools' projects identical. */
export function workspacePackageJson(name: string): string {
  return JSON.stringify({ name, private: true, type: "module" });
}

/** The suite config both tools see: the benchmark's own bounds (see playwright.config.ts there). */
export function suiteConfig(baseURL: string, extra: { readonly eir?: boolean } = {}): string {
  return `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',${extra.eir === true ? "\n  globalTeardown: 'playwright-eir/globalTeardown'," : ""}
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 8_000,
  use: {
    baseURL: ${JSON.stringify(baseURL)},
    actionTimeout: 5_000,
    navigationTimeout: 8_000,${extra.eir === true ? "\n    eirConfig: { mode: { mode: 'heal', healThreshold: 0.7, suggestThreshold: 0.3 } }," : ""}
  },
});
`;
}

/** `node_modules` access to @playwright/test (and optionally playwright-eir) by symlink, never an install. */
export async function linkNodeModules(dir: string, withEir: boolean): Promise<void> {
  const pw = locatePlaywright();
  await mkdir(path.join(dir, "node_modules", "@playwright"), { recursive: true });
  await mkdir(path.join(dir, "node_modules", ".bin"), { recursive: true });
  await symlink(pw.testPackageDir, path.join(dir, "node_modules", "@playwright", "test"));
  await symlink(pw.playwrightDir, path.join(dir, "node_modules", "playwright"));
  await symlink("../playwright/cli.js", path.join(dir, "node_modules", ".bin", "playwright"));
  if (withEir) {
    // The exports map deliberately hides package.json, so resolve the workspace link itself.
    const eirDir = realpathSync(
      new URL("../../node_modules/playwright-eir", import.meta.url).pathname,
    );
    await symlink(eirDir, path.join(dir, "node_modules", "playwright-eir"));
  }
}

const TEMPLATE_DIR = path.join(HEALER_ROOT, "template");
const TEMPLATE_COPY = [
  ".claude",
  ".mcp.json",
  path.join("tests", "seed.spec.ts"),
  path.join("specs", "README.md"),
];
const HEALER_AGENT_REL = path.join(".claude", "agents", "playwright-test-healer.md");

export interface Template {
  readonly dir: string;
  readonly healerAgentSha256: string;
}

async function sha256File(file: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function run(cmd: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${String(code)}`)),
    );
  });
}

/** Generates the agent definitions once with Playwright's own `init-agents`; they are never edited afterwards. */
export async function ensureTemplate(): Promise<Template> {
  const agentFile = path.join(TEMPLATE_DIR, HEALER_AGENT_REL);
  try {
    return { dir: TEMPLATE_DIR, healerAgentSha256: await sha256File(agentFile) };
  } catch {
    // not generated yet
  }
  await mkdir(path.join(TEMPLATE_DIR, "tests"), { recursive: true });
  await writeFile(path.join(TEMPLATE_DIR, "package.json"), workspacePackageJson("healer-template"));
  await writeFile(
    path.join(TEMPLATE_DIR, "playwright.config.ts"),
    suiteConfig("http://localhost:0"),
  );
  await linkNodeModules(TEMPLATE_DIR, false);
  await run(
    path.join(TEMPLATE_DIR, "node_modules", ".bin", "playwright"),
    ["init-agents", "--loop=claude"],
    TEMPLATE_DIR,
  );
  return { dir: TEMPLATE_DIR, healerAgentSha256: await sha256File(agentFile) };
}

export async function createHealerWorkspace(
  template: Template,
  baseURL: string,
  specFileName: string,
  specText: string,
): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "eir-healer-"));
  for (const rel of TEMPLATE_COPY) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await cp(path.join(template.dir, rel), path.join(dir, rel), { recursive: true });
  }
  await writeFile(path.join(dir, "package.json"), workspacePackageJson("healer-workspace"));
  await writeFile(path.join(dir, "playwright.config.ts"), suiteConfig(baseURL));
  await linkNodeModules(dir, false);
  await writeFile(path.join(dir, "tests", specFileName), specText);
  return dir;
}

const SNAPSHOT_SKIP = new Set(["node_modules", "test-results", "playwright-report", "blob-report"]);

/** Content hashes of every file the agent could have touched; Playwright's own output dirs are ignored. */
export async function snapshotFiles(dir: string, rel = ""): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    if (rel === "" && SNAPSHOT_SKIP.has(entry.name)) continue;
    const entryRel = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of await snapshotFiles(dir, entryRel)) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(entryRel, await sha256File(path.join(dir, entryRel)));
    }
  }
  return out;
}

/**
 * The Playwright MCP server writes its own console logs to `.playwright-mcp/`
 * whenever the agent calls `browser_console_messages`. That is tool output,
 * not an agent edit; the pilot's first verdicts flagged it as out-of-bounds
 * until six runs showed the same `.playwright-mcp/console-*.log` and nothing else.
 */
export function isToolOutput(relPath: string): boolean {
  return relPath.split(path.sep)[0] === ".playwright-mcp";
}

/** Paths that changed, appeared or vanished between two snapshots, excluding the one file the agent may edit. */
export function outOfBoundsPaths(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
  specRel: string,
): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths]
    .filter((p) => p !== specRel && !isToolOutput(p) && before.get(p) !== after.get(p))
    .sort();
}
