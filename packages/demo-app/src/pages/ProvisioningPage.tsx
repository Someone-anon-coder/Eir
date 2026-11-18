import { type ReactNode, type SubmitEvent, useState } from "react";
import { domProfile } from "../domProfile";
import { isFlowChanged, isRegressed, isWrapped, overrideAttr, overrideTag } from "../mutation/overrides";
import { gt } from "../mutation/gtMarkers";

type BillingCycle = "monthly" | "quarterly" | "annual";

function wrapIfMutated(mutationKey: string, node: ReactNode): ReactNode {
  return isWrapped(mutationKey) ? <div>{node}</div> : node;
}

export function ProvisioningPage() {
  const [requesterName, setRequesterName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // flow-change `provisioning.confirmStep`: an extra confirmation before the request is sent.
    if (isFlowChanged("provisioning.confirmStep")) {
      setConfirming(true);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className={overrideAttr("provisioning.pageClassName", "provisioning-page")} {...gt("provisioning.pageClassName")}>
      <h2>New Device Provisioning Request</h2>
      <form data-testid={domProfile.provisioning.form} onSubmit={handleSubmit}>
        <label htmlFor={domProfile.provisioning.requesterNameInputId}>Requester Name</label>
        {wrapIfMutated(
          "provisioning.requesterNameInput",
          <input
            id={domProfile.provisioning.requesterNameInputId}
            data-testid={domProfile.provisioning.requesterNameInput}
            {...gt("provisioning.requesterNameInput")}
            value={requesterName}
            onChange={(event) => setRequesterName(event.target.value)}
          />,
        )}

        <label htmlFor={domProfile.provisioning.effectiveDateInputId}>Effective Date</label>
        {wrapIfMutated(
          "provisioning.effectiveDateInput",
          <input
            id={domProfile.provisioning.effectiveDateInputId}
            type="date"
            data-testid={domProfile.provisioning.effectiveDateInput}
            {...gt("provisioning.effectiveDateInput")}
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />,
        )}

        <label htmlFor={domProfile.provisioning.notesTextareaId}>Notes</label>
        {wrapIfMutated(
          "provisioning.notesTextarea",
          <textarea
            id={domProfile.provisioning.notesTextareaId}
            data-testid={domProfile.provisioning.notesTextarea}
            {...gt("provisioning.notesTextarea")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />,
        )}

        <label htmlFor={domProfile.provisioning.billingCycleSelectId}>Billing Cycle</label>
        <select
          id={domProfile.provisioning.billingCycleSelectId}
          value={billingCycle}
          onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>

        {overrideTag("provisioning.submitButton.tag", "button") === "a" ? (
          <a
            href="#submit-request"
            data-testid={domProfile.provisioning.submitButton}
            {...gt("provisioning.submitButton")}
          >
            Submit Request
          </a>
        ) : (
          <button
            type="submit"
            data-testid={domProfile.provisioning.submitButton}
            {...gt("provisioning.submitButton")}
          >
            Submit Request
          </button>
        )}
      </form>
      {confirming && !submitted && (
        <div role="alertdialog" aria-label="Confirm submission">
          <p>Send this provisioning request?</p>
          <button type="button" data-testid="provisioning-confirm" onClick={() => setSubmitted(true)}>
            Confirm submission
          </button>
        </div>
      )}
      {submitted && (
        <p data-testid={domProfile.provisioning.successBanner}>
          {isRegressed("provisioning.successBecomesError")
            ? "Provisioning request failed: server error."
            : `Provisioning request submitted for ${requesterName || "requester"}.`}
        </p>
      )}
    </div>
  );
}
