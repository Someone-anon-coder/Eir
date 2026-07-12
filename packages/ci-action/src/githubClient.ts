/**
 * Deliberately zero-dependency: plain `fetch` (global since Node 18)
 * against GitHub's REST API, rather than `@actions/github`/`@octokit`.
 * PR comments are "issue comments" in GitHub's API — same endpoints a PR
 * and a plain issue share. Cost/alternative considered explicitly per
 * CLAUDE.md §7.4: `@actions/github` would pull in the whole Octokit
 * client for three calls (list/create/update a comment); a raw fetch
 * wrapper is ~60 lines, has no supply-chain surface of its own, and
 * matches Blueprint P7's "lightweight by design" posture applied to
 * tooling, not just the runtime engine.
 */
export interface GithubClientConfig {
  readonly token: string;
  readonly apiUrl: string;
  readonly owner: string;
  readonly repo: string;
}

export interface IssueComment {
  readonly id: number;
  readonly body: string;
}

export interface GithubClient {
  listIssueComments(issueNumber: number): Promise<readonly IssueComment[]>;
  createIssueComment(issueNumber: number, body: string): Promise<IssueComment>;
  updateIssueComment(commentId: number, body: string): Promise<IssueComment>;
}

export class GithubApiError extends Error {
  constructor(
    method: string,
    url: string,
    readonly status: number,
    body: string,
  ) {
    super(`${method} ${url} -> ${String(status)}: ${body}`);
  }
}

interface RawIssueComment {
  readonly id: number;
  readonly body?: string;
}

function toIssueComment(raw: RawIssueComment): IssueComment {
  return { id: raw.id, body: raw.body ?? "" };
}

const PER_PAGE = 100;
const MAX_PAGES = 50;

export function createGithubClient(config: GithubClientConfig): GithubClient {
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "playwright-eir-ci-action",
  };

  async function request(method: string, url: string, body?: unknown): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers:
        body === undefined ? baseHeaders : { ...baseHeaders, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new GithubApiError(method, url, response.status, await response.text());
    }
    return response;
  }

  return {
    async listIssueComments(issueNumber) {
      const all: IssueComment[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const url = `${config.apiUrl}/repos/${config.owner}/${config.repo}/issues/${String(issueNumber)}/comments?per_page=${String(PER_PAGE)}&page=${String(page)}`;
        const response = await request("GET", url);
        const raw: unknown = await response.json();
        if (!Array.isArray(raw)) {
          throw new Error(`unexpected response listing comments for issue ${String(issueNumber)}`);
        }
        const parsed = raw as RawIssueComment[];
        all.push(...parsed.map(toIssueComment));
        if (parsed.length < PER_PAGE) break;
      }
      return all;
    },

    async createIssueComment(issueNumber, body) {
      const url = `${config.apiUrl}/repos/${config.owner}/${config.repo}/issues/${String(issueNumber)}/comments`;
      const response = await request("POST", url, { body });
      return toIssueComment((await response.json()) as RawIssueComment);
    },

    async updateIssueComment(commentId, body) {
      const url = `${config.apiUrl}/repos/${config.owner}/${config.repo}/issues/comments/${String(commentId)}`;
      const response = await request("PATCH", url, { body });
      return toIssueComment((await response.json()) as RawIssueComment);
    },
  };
}
