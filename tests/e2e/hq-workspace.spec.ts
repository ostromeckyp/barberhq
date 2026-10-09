import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { createCloudHarness } from "../support/cloud.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeEach(async () => {
  h = await createCloudHarness("hq-workspace");
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
async function login(page: Page, role: "hq" | "legnicka") {
  await page.goto("/login");
  const c = h.loginCredentials(role);
  await page.getByLabel("Email address").fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "hq" ? "Salon requests" : "Legnicka",
      exact: true,
    }),
  ).toBeVisible();
}
async function workspace(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Workspace", exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function confirm(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (name === "Confirm receipt")
    await dialog.getByLabel("All products are intact").check();
  await dialog.getByRole("button", { name, exact: true }).click();
  await expect(dialog).toBeHidden();
}
async function noHqActions(page: Page) {
  for (const name of ["Approve request", "Reject request", "Confirm dispatch"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
}
test("workspace_switch_drives_menu_request_actions_and_hq_receipt_without_impersonation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page, "hq");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("link", { name: "Salon requests", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await workspace(page, "Salon — Legnicka");
  await expect(page).toHaveURL(/\/salons\/[^/]+$/);
  await expect(
    page.getByText("Acting on behalf of salon Legnicka", { exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Inventory", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "HQ stock", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "HQ available", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Pomada Matowa", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(page.getByText("CREATED", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(page).toHaveURL(/\/salons\/[^/]+\/requests\/[^/]+$/);
  const salonUrl = page.url(),
    id = salonUrl.split("/").at(-1)!;
  await noHqActions(page);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: `Request ${id.slice(0, 8)}`,
      exact: true,
    }),
  ).toBeVisible();
  await noHqActions(page);
  await page.getByRole("button", { name: "Back to requests" }).click();
  await expect(page).toHaveURL(/\/salons\/[^/]+\/requests(?:\?|$)/);
  await workspace(page, "HQ");
  await expect(page).toHaveURL(/\/hq$/);
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(page).toHaveURL(`/hq/requests/${id}`);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Approve request", exact: true }),
  ).toBeVisible();
  await confirm(page, "Approve request");
  await page.getByRole("link", { name: "HQ stock", exact: true }).click();
  await expect(
    page.getByTestId("hq-stock-NBS-MATOWA-100").locator("td"),
  ).toHaveText([/Pomada Matowa/, "18", "2", "16"]);
  await page.goto(`/hq/requests/${id}`);
  await confirm(page, "Confirm dispatch");
  await expect(
    page.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toHaveCount(0);
  await workspace(page, "Salon — Legnicka");
  await page.getByRole("link", { name: "Requests", exact: true }).click();
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(page).toHaveURL(salonUrl);
  await noHqActions(page);
  await confirm(page, "Confirm receipt");
  await expect(page.getByTestId("salon-on-hand")).toHaveText("4");
  const audit = await h.operator.executeGraphql<
    { actionReceipts: { actorUid: string }[] },
    { businessId: string }
  >(
    "query($businessId:String!){actionReceipts(where:{businessId:{eq:$businessId}}){actorUid}}",
    { variables: { businessId: h.businessId } },
  );
  expect(audit.data.actionReceipts).toHaveLength(4);
  expect(
    audit.data.actionReceipts.every((r) => r.actorUid === h.users.hq),
  ).toBe(true);
  // A wrong salon URL must not display or operate the authorized request in the wrong workspace.
  await page.goto(`/salons/${h.businessId}:lodzka/requests/${id}`);
  await expect(
    page.getByRole("heading", { name: "Request unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("salon-on-hand")).toHaveCount(0);
  await page.goto(`/requests/${id}`);
  await expect(page).toHaveURL(`/hq/requests/${id}`);
  for (const path of [`/salons/${h.legnickaId}/requests`, "/hq/stock"]) {
    await page.goto(path);
    await expect(page.getByRole("table")).toBeVisible();
    for (const width of [1280, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
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
    }
  }
  await page.screenshot({
    path: "artifacts/workspace-mobile.png",
    fullPage: true,
  });
});
test("salon_user_never_gets_hq_workspace_or_operations", async ({ page }) => {
  await login(page, "legnicka");
  await expect(
    page.getByRole("link", { name: "HQ stock", exact: true }),
  ).toHaveCount(0);
  if (
    await page.getByRole("combobox", { name: "Workspace", exact: true }).count()
  ) {
    await page
      .getByRole("combobox", { name: "Workspace", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: "HQ", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.goto("/hq");
  await expect(page).toHaveURL(/\/no-access/);
  await page.goto("/hq/requests/unknown");
  await expect(page).toHaveURL(/\/no-access/);
});
