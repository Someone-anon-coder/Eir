import { test as base } from "@playwright/test";
import { EirPage } from "./eirPage.js";

/**
 * The sanctioned Playwright plugin surface (Blueprint §7.1): override the
 * `page` fixture so every test receives an `EirPage` instead of the real
 * `Page`. `EirPage implements Page`, so it is structurally assignable
 * anywhere a `Page` is expected (POM constructors typed `Page`, `expect()`,
 * etc.) — no cast needed at this call site.
 */
export const test = base.extend<{ page: EirPage }>({
  page: async ({ page }, use) => {
    await use(new EirPage(page));
  },
});

export { expect } from "@playwright/test";
