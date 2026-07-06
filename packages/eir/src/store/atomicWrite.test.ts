import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "./atomicWrite.js";

describe("writeFileAtomic", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "eir-atomic-write-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes the file with the given content", async () => {
    const filePath = path.join(dir, "routes", "plan__id__edit.json");
    await writeFileAtomic(filePath, '{"a":1}\n');
    expect(await readFile(filePath, "utf8")).toBe('{"a":1}\n');
  });

  it("creates intermediate directories as needed", async () => {
    const filePath = path.join(dir, "nested", "deeper", "file.json");
    await writeFileAtomic(filePath, "{}\n");
    expect(await readFile(filePath, "utf8")).toBe("{}\n");
  });

  it("leaves no temp file behind on success", async () => {
    const filePath = path.join(dir, "file.json");
    await writeFileAtomic(filePath, "{}\n");
    const entries = await readdir(dir);
    expect(entries).toEqual(["file.json"]);
  });

  it("overwrites an existing file", async () => {
    const filePath = path.join(dir, "file.json");
    await writeFileAtomic(filePath, '{"v":1}\n');
    await writeFileAtomic(filePath, '{"v":2}\n');
    expect(await readFile(filePath, "utf8")).toBe('{"v":2}\n');
  });
});
