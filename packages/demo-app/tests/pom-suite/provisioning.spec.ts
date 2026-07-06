import { expect, test } from "playwright-eir";
import { LoginPage } from "../pom/LoginPage";
import { ProvisioningPage } from "../pom/ProvisioningPage";
import { domProfile } from "../../src/domProfile";

test.describe("provisioning form (POM)", () => {
  test("submits a provisioning request with a selected billing cycle", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login("aayush", "correct-horse");

    const provisioning = new ProvisioningPage(page);
    await provisioning.goto();
    await provisioning.fillAndSubmit({
      requesterName: "Dana Ok",
      effectiveDate: "2026-08-01",
      notes: "New hire onboarding",
      billingCycle: "quarterly",
    });

    await expect(page.getByTestId(domProfile.provisioning.successBanner)).toContainText("Dana Ok");
  });
});
