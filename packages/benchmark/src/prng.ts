/**
 * mulberry32 — a small, well-known deterministic PRNG. Given the same
 * numeric seed, `next()` produces the exact same sequence of floats in
 * [0, 1) every time, on any machine, forever. That determinism is the
 * entire point: every mutation decision downstream (which targets are
 * "live" this run, what their new values are) is derived from this
 * sequence, so `pnpm bench --class X --seed 42` run twice must produce
 * byte-identical output.
 */
export interface Prng {
  next(): number;
  nextInt(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): readonly T[];
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextInt(maxExclusive: number): number {
    return Math.floor(next() * maxExclusive);
  }

  function pick<T>(items: readonly T[]): T {
    const item = items[nextInt(items.length)];
    if (item === undefined) {
      throw new Error("Prng.pick called with an empty array");
    }
    return item;
  }

  function shuffle<T>(items: readonly T[]): readonly T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = nextInt(i + 1);
      const iValue = copy[i];
      const jValue = copy[j];
      if (iValue === undefined || jValue === undefined) {
        throw new Error("Prng.shuffle: unreachable index out of range");
      }
      copy[i] = jValue;
      copy[j] = iValue;
    }
    return copy;
  }

  return { next, nextInt, pick, shuffle };
}
