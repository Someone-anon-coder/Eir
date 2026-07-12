import { bodyHasMarker, REPORT_MARKER } from "./marker.js";
import type { GithubClient } from "./githubClient.js";

export type UpsertOutcome =
  | { readonly kind: "created"; readonly commentId: number }
  | { readonly kind: "updated"; readonly commentId: number }
  | { readonly kind: "skipped-no-findings" };

/**
 * Gate 1's mechanism: list this PR's comments, find the one carrying
 * `REPORT_MARKER` by exact substring match, and edit it in place — never
 * append a new comment on a run that already has one. The no-findings
 * case (work item 4) is asymmetric on purpose: a clean run *updates* an
 * existing Eir comment to say so (a stale "3 suggestions" comment sitting
 * on an otherwise-fixed PR would be actively misleading), but never
 * *creates* a fresh "nothing to see here" comment on a PR Eir never had
 * anything to say about — that would just be spam of a different flavor.
 */
export async function upsertEirComment(
  client: GithubClient,
  issueNumber: number,
  body: string,
  hasFindings: boolean,
): Promise<UpsertOutcome> {
  const comments = await client.listIssueComments(issueNumber);
  const existing = comments.find((comment) => bodyHasMarker(comment.body, REPORT_MARKER));

  if (existing !== undefined) {
    const updated = await client.updateIssueComment(existing.id, body);
    return { kind: "updated", commentId: updated.id };
  }

  if (!hasFindings) {
    return { kind: "skipped-no-findings" };
  }

  const created = await client.createIssueComment(issueNumber, body);
  return { kind: "created", commentId: created.id };
}
