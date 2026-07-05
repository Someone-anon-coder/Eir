import type { Locator, Page } from "@playwright/test";
import { domProfile } from "../../src/domProfile";

export class AccountPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/account");
  }

  async openDeleteDialog(): Promise<void> {
    await this.page.getByTestId(domProfile.account.openDeleteButton).click();
  }

  dialog(): Locator {
    return this.page.getByTestId(domProfile.account.dialog);
  }

  async cancel(): Promise<void> {
    await this.page.getByTestId(domProfile.account.cancelButton).click();
  }

  async confirm(): Promise<void> {
    await this.page.getByTestId(domProfile.account.confirmButton).click();
  }
}
