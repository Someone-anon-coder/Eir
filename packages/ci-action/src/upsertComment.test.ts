import { describe, expect, it } from "vitest";
import type { GithubClient, IssueComment } from "./githubClient.js";
import { REPORT_MARKER } from "./marker.js";
import { upsertEirComment } from "./upsertComment.js";

function fakeClient(initialComments: readonly IssueComment[]): {
  client: GithubClient;
  comments: IssueComment[];
} {
  const comments = [...initialComments];
  let nextId = Math.max(0, ...comments.map((c) => c.id)) + 1;
  const client: GithubClient = {
    async listIssueComments() {
      return comments;
    },
    async createIssueComment(_issueNumber, body) {
      const created = { id: nextId, body };
      nextId += 1;
      comments.push(created);
      return created;
    },
    async updateIssueComment(commentId, body) {
      const index = comments.findIndex((c) => c.id === commentId);
      if (index === -1) throw new Error("comment not found");
      comments[index] = { id: commentId, body };
      return comments[index];
    },
  };
  return { client, comments };
}

describe("upsertEirComment", () => {
  it("creates a new comment when none of this PR's comments carry the marker", async () => {
    const { client, comments } = fakeClient([{ id: 1, body: "an unrelated human comment" }]);
    const outcome = await upsertEirComment(client, 42, `body ${REPORT_MARKER}`, true);
    expect(outcome).toEqual({ kind: "created", commentId: 2 });
    expect(comments).toHaveLength(2);
  });

  it("updates the existing marked comment in place rather than creating a second one", async () => {
    const { client, comments } = fakeClient([
      { id: 1, body: "an unrelated human comment" },
      { id: 2, body: `## Eir report\n\nold body\n\n${REPORT_MARKER}` },
    ]);
    const outcome = await upsertEirComment(
      client,
      42,
      `## Eir report\n\nnew body\n\n${REPORT_MARKER}`,
      true,
    );
    expect(outcome).toEqual({ kind: "updated", commentId: 2 });
    expect(comments).toHaveLength(2);
    expect(comments[1]?.body).toContain("new body");
  });

  it("skips posting a fresh no-findings comment when Eir has never commented on this PR", async () => {
    const { client, comments } = fakeClient([]);
    const outcome = await upsertEirComment(client, 42, `body ${REPORT_MARKER}`, false);
    expect(outcome).toEqual({ kind: "skipped-no-findings" });
    expect(comments).toHaveLength(0);
  });

  it("still updates an existing marked comment to a clean state, rather than leaving it stale", async () => {
    const { client, comments } = fakeClient([
      { id: 5, body: `## Eir report\n\n3 suggested\n\n${REPORT_MARKER}` },
    ]);
    const outcome = await upsertEirComment(
      client,
      42,
      `## Eir report\n\nNo heal-eligible activity this run.\n\n${REPORT_MARKER}`,
      false,
    );
    expect(outcome).toEqual({ kind: "updated", commentId: 5 });
    expect(comments[0]?.body).toContain("No heal-eligible activity");
  });
});
