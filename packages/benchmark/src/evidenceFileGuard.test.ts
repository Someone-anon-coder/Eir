import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertWritable } from "./evidenceFileGuard.js";

describe("assertWritable", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-evidence-guard-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("allows writing a path that doesn't exist yet, force or not", async () => {
    const target = path.join(dir, "fresh.json");
    await expect(assertWritable(target, false)).resolves.toBeUndefined();
    await expect(assertWritable(target, true)).resolves.toBeUndefined();
  });

  it("refuses to overwrite an existing file without --force (NOTE-008)", async () => {
    const target = path.join(dir, "existing.json");
    await writeFile(target, "{}");
    await expect(assertWritable(target, false)).rejects.toThrow(/already exists.*--force/s);
  });

  it("allows overwriting an existing file when --force is passed", async () => {
    const target = path.join(dir, "existing.json");
    await writeFile(target, "{}");
    await expect(assertWritable(target, true)).resolves.toBeUndefined();
  });
});
