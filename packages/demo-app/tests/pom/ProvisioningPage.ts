import type { Page } from "@playwright/test";
import { domProfile } from "../../src/domProfile";

interface ProvisioningFields {
  requesterName: string;
  effectiveDate: string;
  notes: string;
  billingCycle: "monthly" | "quarterly" | "annual";
}

export class ProvisioningPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/provisioning");
  }

  async fillAndSubmit(fields: ProvisioningFields): Promise<void> {
    await this.page.getByTestId(domProfile.provisioning.requesterNameInput).fill(fields.requesterName);
    await this.page.getByTestId(domProfile.provisioning.effectiveDateInput).fill(fields.effectiveDate);
    await this.page.getByTestId(domProfile.provisioning.notesTextarea).fill(fields.notes);
    await this.page.getByLabel("Billing Cycle").selectOption(fields.billingCycle);
    await this.page.getByTestId(domProfile.provisioning.submitButton).click();
  }
}
