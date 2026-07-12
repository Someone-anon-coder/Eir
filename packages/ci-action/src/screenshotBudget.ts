/**
 * GitHub caps a PR/issue comment body at 65,536 characters. A handful of
 * small element-crop screenshots fit easily as inline base64 data URIs
 * (the trust-building touch Blueprint §7.7 calls out), but a run with many
 * rows could blow the budget. Pure and greedy: inline in row order until
 * the budget is spent, then stop — never partially truncate an image.
 */
export interface ScreenshotCandidate {
  readonly rowIndex: number;
  readonly base64: string;
}

export interface ScreenshotPlan {
  readonly dataUriByRowIndex: ReadonlyMap<number, string>;
  readonly omittedCount: number;
}

const DATA_URI_PREFIX = "data:image/png;base64,";

export function planScreenshotInlining(
  candidates: readonly ScreenshotCandidate[],
  totalBudgetChars: number,
): ScreenshotPlan {
  const dataUriByRowIndex = new Map<number, string>();
  let used = 0;
  let omittedCount = 0;

  for (const candidate of candidates) {
    const dataUri = `${DATA_URI_PREFIX}${candidate.base64}`;
    if (used + dataUri.length > totalBudgetChars) {
      omittedCount += 1;
      continue;
    }
    dataUriByRowIndex.set(candidate.rowIndex, dataUri);
    used += dataUri.length;
  }

  return { dataUriByRowIndex, omittedCount };
}
