/**
 * Shared string-similarity primitive for scorer 2 (text) and scorer 3
 * (label) — kept as one small pure module rather than duplicated inline in
 * each scorer, since both need the exact same blend (see docs/tuning-log.md
 * for why token overlap is blended in alongside edit distance: single-word
 * labels like "Edit"/"Delete" give edit distance very little to work with).
 */

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = distances[i];
      const prevRow = distances[i - 1];
      if (row === undefined || prevRow === undefined) continue;
      row[j] = Math.min((prevRow[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prevRow[j - 1] ?? 0) + cost);
    }
  }

  return distances[rows - 1]?.[cols - 1] ?? Math.max(a.length, b.length);
}

/** 1 for identical strings, 0 for maximally different, normalized by the longer string's length. */
export function normalizedEditSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenize(value: string): readonly string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** Jaccard overlap of word tokens — survives word-order changes and partial rewording that edit distance penalizes harshly. */
export function tokenOverlapSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize += 1;
  }
  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 1 : intersectionSize / unionSize;
}

/** Blend: edit similarity carries single-word/short-string cases, token overlap carries reworded phrases. */
export function textSimilarity(a: string, b: string): number {
  return 0.5 * normalizedEditSimilarity(a, b) + 0.5 * tokenOverlapSimilarity(a, b);
}
