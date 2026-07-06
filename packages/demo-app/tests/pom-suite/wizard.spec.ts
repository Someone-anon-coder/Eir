import { expect, test } from "playwright-eir";
import { LoginPage } from "../pom/LoginPage";
import { RequestWizardPage } from "../pom/RequestWizardPage";
import { domProfile } from "../../src/domProfile";

test.describe("access request wizard (POM)", () => {
  test("completes the 3-step access request wizard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("aayush", "correct-horse");

    const wizard = new RequestWizardPage(page);
    await wizard.goto();

    await wizard.fillStepOne("Q3 dashboard access", "Dana Ok");
    await expect(page).toHaveURL(/#step-2$/);

    await wizard.fillStepTwo("Billing Reports", "30 days");
    await expect(page).toHaveURL(/#step-3$/);
    await expect(page.getByTestId(domProfile.wizard.reviewSummary)).toContainText(
      "Billing Reports",
    );

    await wizard.submitStepThree();
    await expect(page.getByTestId(domProfile.wizard.successBanner)).toContainText(
      "Q3 dashboard access",
    );
  });
});
