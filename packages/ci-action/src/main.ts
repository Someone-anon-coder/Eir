import path from "node:path";
import { createGithubClient } from "./githubClient.js";
import { resolveActionInputs, resolveGithubContext } from "./githubContext.js";
import { renderComment } from "./renderComment.js";
import { readEirReport } from "./report.js";
import { resolveScreenshotDataUris } from "./resolveScreenshots.js";
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

  const reportDir = path.dirname(path.resolve(inputs.reportPath));
  const screenshotPlan = await resolveScreenshotDataUris(report.rows, reportDir);

  const body = renderComment({
    rows: report.rows,
    dataUriByRowIndex: screenshotPlan.dataUriByRowIndex,
    omittedScreenshotCount: screenshotPlan.omittedCount,
    mode: inputs.mode,
    docsUrl: inputs.docsUrl,
  });

  const client = createGithubClient({
    token: context.token,
    apiUrl: context.apiUrl,
    owner: context.owner,
    repo: context.repo,
  });

  const hasFindings = report.rows.some((row) => row.suggestion !== null);
  const outcome = await upsertEirComment(client, context.prNumber, body, hasFindings);

  const detail =
    outcome.kind === "skipped-no-findings" ? "" : ` (comment ${String(outcome.commentId)})`;
  console.log(`[eir-ci-action] ${outcome.kind}${detail}`);
}

run().catch((error: unknown) => {
  console.error("[eir-ci-action] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
