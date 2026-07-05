import type { Page } from "@playwright/test";
import { domProfile } from "../../src/domProfile";

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByTestId(domProfile.login.usernameInput).fill(username);
    await this.page.getByTestId(domProfile.login.passwordInput).fill(password);
    await this.page.getByTestId(domProfile.login.submitButton).click();
  }
}
