import { createGithubClient } from "./githubClient.js";
import { hasFindings } from "./findings.js";
import { resolveActionInputs, resolveGithubContext, resolveRunUrl } from "./githubContext.js";
import { renderComment } from "./renderComment.js";
import { readEirReport } from "./report.js";
import { upsertEirComment } from "./upsertComment.js";

async function run(): Promise<void> {
  const inputs = resolveActionInputs(process.env);
  const context = await resolveGithubContext(process.env);

  const report = await readEirReport(inputs.reportPath).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `could not read "${inputs.reportPath}" (${detail}) — is playwright-eir/reporter configured in playwright.config.ts, and did the test run finish before this step?`,
    );
  });

  const body = renderComment({
    rows: report.rows,
    screenshotArtifactUrl: resolveRunUrl(process.env),
    mode: inputs.mode,
    docsUrl: inputs.docsUrl,
  });

  const client = createGithubClient({
    token: context.token,
    apiUrl: context.apiUrl,
    owner: context.owner,
    repo: context.repo,
  });

  const outcome = await upsertEirComment(client, context.prNumber, body, hasFindings(report.rows));

  const detail =
    outcome.kind === "skipped-no-findings" ? "" : ` (comment ${String(outcome.commentId)})`;
  console.log(`[eir-ci-action] ${outcome.kind}${detail}`);
}

run().catch((error: unknown) => {
  console.error("[eir-ci-action] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
