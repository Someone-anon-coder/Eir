import type { Locator, Page } from "@playwright/test";
import { domProfile } from "../../src/domProfile";

export class DevicesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/devices");
  }

  activeTable(): Locator {
    return this.page.getByTestId(domProfile.devices.active.testId);
  }

  archivedTable(): Locator {
    return this.page.getByTestId(domProfile.devices.archived.testId);
  }

  rowByName(table: Locator, name: string): Locator {
    return table.getByRole("row").filter({ hasText: name });
  }

  async sortActiveByName(): Promise<void> {
    await this.activeTable().getByTestId(domProfile.devices.nameHeaderButton).click();
  }
}
