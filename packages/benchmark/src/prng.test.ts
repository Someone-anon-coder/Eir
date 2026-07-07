import { describe, expect, it } from "vitest";
import { createPrng } from "./prng.js";

describe("createPrng determinism", () => {
  it.each([1, 2, 42, 12345, 999999])("seed %i produces the same sequence on repeat construction", (seed) => {
    const a = createPrng(seed);
    const b = createPrng(seed);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds produce different sequences", () => {
    const a = createPrng(1);
    const b = createPrng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() stays within [0, 1)", () => {
    const prng = createPrng(7);
    for (let i = 0; i < 1000; i++) {
      const value = prng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("nextInt(n) stays within [0, n)", () => {
    const prng = createPrng(7);
    for (let i = 0; i < 1000; i++) {
      const value = prng.nextInt(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("pick() only returns elements from the input array, deterministically per seed", () => {
    const items = ["a", "b", "c", "d"] as const;
    const a = createPrng(99);
    const b = createPrng(99);
    const picksA = Array.from({ length: 10 }, () => a.pick(items));
    const picksB = Array.from({ length: 10 }, () => b.pick(items));
    expect(picksA).toEqual(picksB);
    for (const pick of picksA) {
      expect(items).toContain(pick);
    }
  });

  it("pick() throws on an empty array", () => {
    const prng = createPrng(1);
    expect(() => prng.pick([])).toThrow();
  });

  it("shuffle() is a permutation of the input, deterministic per seed", () => {
    const items = [1, 2, 3, 4, 5];
    const a = createPrng(55);
    const b = createPrng(55);
    const shuffledA = a.shuffle(items);
    const shuffledB = b.shuffle(items);
    expect(shuffledA).toEqual(shuffledB);
    expect([...shuffledA].sort()).toEqual([...items].sort());
  });

  it("shuffle() does not mutate its input", () => {
    const items = [1, 2, 3];
    const prng = createPrng(3);
    prng.shuffle(items);
    expect(items).toEqual([1, 2, 3]);
  });
});
