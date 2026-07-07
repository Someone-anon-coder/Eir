import { useEffect, useState, type ReactNode } from "react";
import { domProfile } from "../domProfile";
import { isWrapped, overrideOrder, overrideText } from "../mutation/overrides";

type Step = 1 | 2 | 3;

function wrapIfMutated(mutationKey: string, node: ReactNode): ReactNode {
  return isWrapped(mutationKey) ? <div>{node}</div> : node;
}

function parseStepFromHash(hash: string): Step {
  if (hash === "#step-2") return 2;
  if (hash === "#step-3") return 3;
  return 1;
}

function goToStep(step: Step): void {
  window.location.hash = `step-${step}`;
}

export function RequestWizardPage() {
  const [step, setStep] = useState<Step>(() => parseStepFromHash(window.location.hash));
  const [title, setTitle] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [resource, setResource] = useState("Device Inventory");
  const [duration, setDuration] = useState("7 days");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function handleHashChange() {
      setStep(parseStepFromHash(window.location.hash));
    }
    window.addEventListener("hashchange", handleHashChange);
    if (window.location.hash === "") {
      window.location.hash = "step-1";
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleSubmit() {
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="wizard-page" data-testid={domProfile.wizard.root}>
        <p data-testid={domProfile.wizard.successBanner}>Access request submitted for {title}.</p>
      </div>
    );
  }

  return (
    <div className="wizard-page" data-testid={domProfile.wizard.root}>
      {step === 1 && (
        <section>
          <h2 data-testid={domProfile.wizard.stepHeading}>Step 1: Basic Info</h2>
          <label htmlFor={domProfile.wizard.titleInputId}>
            {overrideText("wizard.titleInput.label", "Request Title")}
          </label>
          {wrapIfMutated(
            "wizard.titleInput",
            <input
              id={domProfile.wizard.titleInputId}
              data-testid={domProfile.wizard.titleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />,
          )}
          <label htmlFor={domProfile.wizard.requestedByInputId}>
            {overrideText("wizard.requestedByInput.label", "Requested By")}
          </label>
          {wrapIfMutated(
            "wizard.requestedByInput",
            <input
              id={domProfile.wizard.requestedByInputId}
              data-testid={domProfile.wizard.requestedByInput}
              value={requestedBy}
              onChange={(event) => setRequestedBy(event.target.value)}
            />,
          )}
          <button
            type="button"
            data-testid={domProfile.wizard.nextButton}
            onClick={() => goToStep(2)}
          >
            {overrideText("wizard.nextButton.step1.text", "Next")}
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 data-testid={domProfile.wizard.stepHeading}>Step 2: Access Scope</h2>
          <label htmlFor={domProfile.wizard.resourceSelectId}>Resource</label>
          <select
            id={domProfile.wizard.resourceSelectId}
            value={resource}
            onChange={(event) => setResource(event.target.value)}
          >
            {overrideOrder("wizard.resourceSelect.optionOrder", [
              <option key="Device Inventory" value="Device Inventory">
                Device Inventory
              </option>,
              <option key="Billing Reports" value="Billing Reports">
                Billing Reports
              </option>,
              <option key="Admin Console" value="Admin Console">
                Admin Console
              </option>,
            ])}
          </select>
          <label htmlFor={domProfile.wizard.durationSelectId}>Duration</label>
          <select
            id={domProfile.wizard.durationSelectId}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            {overrideOrder("wizard.durationSelect.optionOrder", [
              <option key="7 days" value="7 days">
                7 days
              </option>,
              <option key="30 days" value="30 days">
                30 days
              </option>,
              <option key="90 days" value="90 days">
                90 days
              </option>,
            ])}
          </select>
          <button
            type="button"
            data-testid={domProfile.wizard.backButton}
            onClick={() => goToStep(1)}
          >
            Back
          </button>
          <button
            type="button"
            data-testid={domProfile.wizard.nextButton}
            onClick={() => goToStep(3)}
          >
            Next
          </button>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 data-testid={domProfile.wizard.stepHeading}>Step 3: Review &amp; Submit</h2>
          <ul data-testid={domProfile.wizard.reviewSummary}>
            <li>Title: {title}</li>
            <li>Requested By: {requestedBy}</li>
            <li>Resource: {resource}</li>
            <li>Duration: {duration}</li>
          </ul>
          <button
            type="button"
            data-testid={domProfile.wizard.backButton}
            onClick={() => goToStep(2)}
          >
            Back
          </button>
          <button type="button" data-testid={domProfile.wizard.submitButton} onClick={handleSubmit}>
            Submit
          </button>
        </section>
      )}
    </div>
  );
}
