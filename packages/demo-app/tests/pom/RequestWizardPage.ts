import type { Page } from "@playwright/test";
import { domProfile } from "../../src/domProfile";

export class RequestWizardPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/requests/new");
  }

  async fillStepOne(title: string, requestedBy: string): Promise<void> {
    await this.page.getByTestId(domProfile.wizard.titleInput).fill(title);
    await this.page.getByTestId(domProfile.wizard.requestedByInput).fill(requestedBy);
    await this.page.getByTestId(domProfile.wizard.nextButton).click();
  }

  async fillStepTwo(resource: string, duration: string): Promise<void> {
    await this.page.getByLabel("Resource").selectOption(resource);
    await this.page.getByLabel("Duration").selectOption(duration);
    await this.page.getByTestId(domProfile.wizard.nextButton).click();
  }

  async submitStepThree(): Promise<void> {
    await this.page.getByTestId(domProfile.wizard.submitButton).click();
  }
}
