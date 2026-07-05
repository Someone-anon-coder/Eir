import { expect, test } from "@playwright/test";
import { LoginPage } from "../pom/LoginPage";
import { AccountPage } from "../pom/AccountPage";
import { domProfile } from "../../src/domProfile";

test.describe("account delete dialog (POM)", () => {
  test("opens and cancels the delete-account dialog without deleting", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("aayush", "correct-horse");

    const account = new AccountPage(page);
    await account.goto();
    await account.openDeleteDialog();
    await expect(account.dialog()).toBeVisible();

    await account.cancel();
    await expect(account.dialog()).toBeHidden();
    await expect(page.getByTestId(domProfile.account.deletedBanner)).toHaveCount(0);
  });
});
