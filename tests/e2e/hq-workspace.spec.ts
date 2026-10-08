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
      name: role === "hq" ? "Request queue" : "Legnicka",
      exact: true,
    }),
  ).toBeVisible();
}
async function submit(page: Page, product: string) {
  await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}`);
  await expect(
    page.getByRole("heading", { name: "HQ availability", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `Request ${product}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click();
  await expect(page.getByText("CREATED", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(page).toHaveURL(/\/requests\//);
  return page.url();
}
test("hq_orders_for_salon_and_operates_from_salon_list_direct_link_and_queue", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page, "hq");
  const first = await submit(page, "Pomada Matowa");
  await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}/requests`);
  await page.getByRole("link", { name: "Open request", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve request", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reject request", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Confirm dispatch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to requests" }).click();
  await expect(page).toHaveURL(/\/salons\/.*\/requests/);
  await page.goto("/hq/stock");
  const row = page.getByTestId("hq-stock-NBS-MATOWA-100");
  await expect(row.locator("td")).toHaveText([
    /Pomada Matowa/,
    "18",
    "2",
    "16",
  ]);
  const second = await submit(page, "Pomada Cement");
  await page.goto("/hq");
  await page
    .locator("tr.request-row")
    .filter({ hasText: "Pomada Cement" })
    .getByRole("link", { name: "Open request" })
    .click();
  await expect(page).toHaveURL(second);
  await page
    .getByRole("button", { name: "Reject request", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Reason for rejection")
    .fill("Please recount salon stock.");
  await dialog
    .getByRole("button", { name: "Reject request", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Please recount salon stock.", { exact: false }),
  ).toBeVisible();
  await page.goto(first);
  await expect(
    page.getByRole("button", { name: "Confirm dispatch", exact: true }),
  ).toBeVisible();
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
  for (const path of [
    `/salons/${encodeURIComponent(h.legnickaId)}/requests`,
    "/hq/stock",
  ]) {
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
    const positions = await page
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.map((row) =>
          Array.from(row.querySelectorAll("td")).map((cell) =>
            Math.round(cell.getBoundingClientRect().x),
          ),
        ),
      );
    expect(positions.length).toBeGreaterThan(1);
    for (const position of positions) expect(position).toEqual(positions[0]);
  }
  await page.screenshot({
    path: "artifacts/hq-stock-mobile.png",
    fullPage: true,
  });
});
test("salon_keeps_availability_but_cannot_open_hq_stock_or_approve", async ({
  page,
}) => {
  await login(page, "legnicka");
  await expect(
    page.getByRole("heading", { name: "HQ availability", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "HQ stock", exact: true }),
  ).toHaveCount(0);
  await page.goto("/hq/stock");
  await expect(page).toHaveURL(/\/no-access/);
});
