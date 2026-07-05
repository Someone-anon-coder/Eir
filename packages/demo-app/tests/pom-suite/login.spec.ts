import { expect, test } from "@playwright/test";
import { LoginPage } from "../pom/LoginPage";
import { domProfile } from "../../src/domProfile";

test.describe("login (POM)", () => {
  test("signs in and lands on the devices dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("aayush", "correct-horse");

    await expect(page).toHaveURL(/\/dashboard\/devices$/);
    await expect(page.getByTestId(domProfile.devices.active.testId)).toBeVisible();
  });
});
