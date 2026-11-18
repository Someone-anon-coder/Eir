import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  actionIdentity,
  anchorProvenance,
  commentAndFixmeLines,
  receiverChange,
  type AnchorProvenance,
  type ReceiverChange,
} from "./audit.js";
import { loadRecords } from "./loadRecords.js";
import { materializeSpec } from "./specDraft.js";
import { extractSpecFacts } from "./specFacts.js";
import { draftFor } from "./specDrafts.js";
import { HEALER_ROOT } from "./workspace.js";

const WARD = new URL("../../../demo-app/src", import.meta.url).pathname;

/**
 * The injected bug behind each `fixme`d target, quoted from Ward's source:
 * the comment at the injection site where there is one, otherwise the
 * defining code. No judgement here about whether a `fixme` comment names it.
 */
export const INJECTED_BUGS: Readonly<
  Record<string, { readonly bug: string; readonly source: string }>
> = {
  "real-regression.account.confirmDoesNothing": {
    bug: "the confirm click is swallowed.",
    source: "pages/AccountPage.tsx (comment)",
  },
  "real-regression.devices.removeKeepsRow": {
    bug: "the row is never removed.",
    source: "pages/DevicesPage.tsx (comment)",
  },
  "real-regression.devices.saveIgnoresEdit": {
    bug: "Save closes edit mode but drops the edit.",
    source: "pages/DevicesPage.tsx (comment)",
  },
  "real-regression.login.acceptsEmptyPassword": {
    bug: "the password check is skipped.",
    source: "pages/LoginPage.tsx (comment)",
  },
  "real-regression.provisioning.successBecomesError": {
    bug: 'the success banner reads "Provisioning request failed: server error." after submit.',
    source:
      'pages/ProvisioningPage.tsx (code: isRegressed("provisioning.successBecomesError") ? "Provisioning request failed: server error." : …)',
  },
  "real-regression.wizard.reviewShowsWrongValue": {
    bug: 'the review summary\'s "Requested By" line shows the title instead of the requested-by value.',
    source:
      'pages/RequestWizardPage.tsx (code: {isRegressed("wizard.reviewShowsWrongValue") ? title : requestedBy})',
  },
  "real-regression.wizard.submitDoesNothing": {
    bug: "the final submit is swallowed.",
    source: "pages/RequestWizardPage.tsx (comment)",
  },
  "tag-swap.provisioning.submitButton": {
    bug: 'the Submit Request control is rendered as <a href="#submit-request"> instead of a <button type="submit">; the anchor has no submit handler.',
    source:
      'payload { tags: { "provisioning.submitButton.tag": "a" } }; pages/ProvisioningPage.tsx',
  },
};

export interface FixmeEvidence {
  readonly runClass: string;
  readonly targetId: string;
  readonly run: number;
  readonly commentLines: readonly string[];
  readonly injectedBug: string;
  readonly injectedBugSource: string;
}

export interface AuditEvidence {
  readonly runClass: string;
  readonly targetId: string;
  readonly run: number;
  readonly originalActionIdentity: string;
  readonly originalAction: string;
  readonly finalAction: string;
  readonly receiver: ReceiverChange;
  readonly anchors: readonly AnchorProvenance[];
  readonly groundTruthElement: string;
  readonly actedOn: readonly string[];
}

async function main(): Promise<void> {
  const records = (await loadRecords(42)).filter((r) => r.tool === "healer");
  const pageData = await readFile(path.join(WARD, "pages", "DevicesPage.tsx"), "utf-8");
  const fixme: FixmeEvidence[] = [];
  const audit: AuditEvidence[] = [];
  for (const r of records) {
    const sourceId = r.targetId.replace(/^compound-release\//, "");
    const draft = draftFor(sourceId);
    const finalSpec =
      r.healer?.finalSpecFile === undefined
        ? undefined
        : await readFile(r.healer.finalSpecFile, "utf-8");
    if (draft === undefined || finalSpec === undefined) continue;
    const original = materializeSpec(draft);
    if (r.outcome === "fixme") {
      const injected = INJECTED_BUGS[sourceId];
      fixme.push({
        runClass: r.mutationClass,
        targetId: r.targetId,
        run: r.run,
        commentLines: commentAndFixmeLines(finalSpec),
        injectedBug: injected?.bug ?? "(no definition recorded)",
        injectedBugSource: injected?.source ?? "",
      });
    }
    if (r.outcome === "healed-wrong") {
      audit.push({
        runClass: r.mutationClass,
        targetId: r.targetId,
        run: r.run,
        originalActionIdentity: actionIdentity(original),
        originalAction: extractSpecFacts(original).actionLocators.join(" ; "),
        finalAction: extractSpecFacts(finalSpec).actionLocators.join(" ; "),
        receiver: receiverChange(original, finalSpec),
        anchors: anchorProvenance(finalSpec, original, pageData),
        groundTruthElement: draft.element,
        actedOn: r.actedOn,
      });
    }
  }
  const outDir = path.join(HEALER_ROOT, "verification");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "evidence.json"), JSON.stringify({ fixme, audit }, null, 2));
  console.log(`fixme comments: ${fixme.length}; audit rows: ${audit.length}`);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
