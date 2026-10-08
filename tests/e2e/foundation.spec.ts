import { test, expect, type Page } from "@playwright/test";
import { createCloudHarness } from "../support/cloud.ts";
import { AxeBuilder } from "@axe-core/playwright";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeEach(async () => {
  h = await createCloudHarness("browser");
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
async function login(page: Page, role: "legnicka" | "unassigned" = "legnicka") {
  await page.goto("/login");
  const credentials = h.loginCredentials(role);
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
test("real sign-in, scoped quantities, nested refresh and sign-out", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Salon stock" })
      .getByText("Pomada Matowa", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "BarberHQ DEMO" }).click();
  await expect(
    page.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
  await page.screenshot({
    path: "artifacts/inventory-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Sign in with your work account.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveCount(0);
});
test("unassigned user sees no-access state", async ({ page }) => {
  await login(page, "unassigned");
  await expect(
    page.getByRole("heading", { name: "No workspace access" }),
  ).toBeVisible();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveCount(0);
});
test("failed read offers retry instead of inventing zero stock", async ({
  page,
}) => {
  let aborted = 0;
  await page.route("**:9399/**", async (route) => {
    if (route.request().postData()?.includes("GetSalonInventory")) {
      aborted++;
      await route.abort();
    } else await route.continue();
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Inventory is unavailable" }),
  ).toBeVisible();
  expect(aborted).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveCount(0);
  await page.unrouteAll();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
});
test("mobile layout and keyboard login do not overflow at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/login");
  await page.screenshot({ path: "artifacts/login-mobile.png", fullPage: true });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const credentials = h.loginCredentials("legnicka");
  await page.getByLabel("Email address").focus();
  await page.keyboard.type(credentials.email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(credentials.password);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
  await page.screenshot({
    path: "artifacts/inventory-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("failed refresh keeps last-known stock and retry replaces the stale state", async ({
  page,
}) => {
  await login(page);
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
  await page.route("**:9399/**", async (route) => {
    if (route.request().postData()?.includes("GetSalonInventory"))
      await route.abort();
    else await route.continue();
  });
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "last loaded quantities",
  );
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
  await page.unrouteAll();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "last loaded quantities" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("stock-NBS-MATOWA-100")).toHaveText("2");
});
