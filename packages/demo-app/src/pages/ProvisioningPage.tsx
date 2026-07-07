import { type ReactNode, type SubmitEvent, useState } from "react";
import { domProfile } from "../domProfile";
import { isWrapped } from "../mutation/overrides";

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

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="provisioning-page">
      <h2>New Device Provisioning Request</h2>
      <form data-testid={domProfile.provisioning.form} onSubmit={handleSubmit}>
        <label htmlFor={domProfile.provisioning.requesterNameInputId}>Requester Name</label>
        {wrapIfMutated(
          "provisioning.requesterNameInput",
          <input
            id={domProfile.provisioning.requesterNameInputId}
            data-testid={domProfile.provisioning.requesterNameInput}
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

        <button type="submit" data-testid={domProfile.provisioning.submitButton}>
          Submit Request
        </button>
      </form>
      {submitted && (
        <p data-testid={domProfile.provisioning.successBanner}>
          Provisioning request submitted for {requesterName || "requester"}.
        </p>
      )}
    </div>
  );
}
