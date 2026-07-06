import { expect, test } from "playwright-eir";
import { LoginPage } from "../pom/LoginPage";
import { DevicesPage } from "../pom/DevicesPage";
import { domProfile } from "../../src/domProfile";

test.describe("devices dashboard (POM)", () => {
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("aayush", "correct-horse");
  });

  test("sorts the active devices table by name", async ({ page }) => {
    const devices = new DevicesPage(page);
    await devices.goto();
    await devices.sortActiveByName();

    const firstRowName = await devices
      .activeTable()
      .locator("tbody tr")
      .first()
      .locator("td")
      .first()
      .innerText();

    expect(firstRowName).toBe("Conference Room Display");
  });

  test("edits a device name via the row action", async ({ page }) => {
    const devices = new DevicesPage(page);
    await devices.goto();

    // Anchored on the owner column, not the name — the name cell becomes an
    // <input> in edit mode, so a name-based filter would stop matching mid-test.
    const row = devices.rowByName(devices.activeTable(), "K. Nguyen");
    await row.getByTestId(domProfile.devices.editAction).click();
    await row.locator("input").fill("Warehouse Scanner (Bay 2)");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(devices.activeTable().getByText("Warehouse Scanner (Bay 2)")).toBeVisible();
  });

  test("targets the correct table when active and archived share a device name", async ({
    page,
  }) => {
    const devices = new DevicesPage(page);
    await devices.goto();

    const activeRow = devices.rowByName(devices.activeTable(), "Front Desk Tablet");
    await activeRow.getByTestId(domProfile.devices.removeAction).click();

    await expect(devices.activeTable().getByText("Front Desk Tablet")).toHaveCount(0);
    await expect(devices.archivedTable().getByText("Front Desk Tablet")).toBeVisible();
  });
});
