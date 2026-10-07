import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { createCloudHarness } from "../support/cloud.ts";
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeAll(async () => {
  h = await createCloudHarness("replenishment-ui");
});
test.afterAll(async () => {
  if (h) await h.dispose();
});
async function login(page: Page, role: "hq" | "legnicka") {
  await page.goto("/login");
  const c = h.loginCredentials(role);
  await page.getByLabel("Email address").fill(c.email);
  await page.getByLabel("Password", { exact: true }).fill(c.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: label, exact: true }).click();
  await expect(dialog).toBeHidden();
}
test("two_units_move_once; damaged_receipt_is_blocked; accessible responsive lifecycle", async ({
  browser,
}) => {
  const salonContext = await browser.newContext();
  const hqContext = await browser.newContext();
  const salon = await salonContext.newPage();
  const hq = await hqContext.newPage();
  await login(salon, "legnicka");
  await expect(
    salon.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  await salon
    .getByRole("button", { name: "Request Pomada Matowa", exact: true })
    .click();
  await salon.getByRole("button", { name: "Add to list", exact: true }).click();
  await salon
    .getByRole("button", { name: "Submit requests", exact: true })
    .click();
  await expect(salon.getByText("2 pcs · CREATED")).toBeVisible({
    timeout: 20000,
  });
  await salon
    .getByRole("link", { name: "Open request", exact: true })
    .first()
    .click();
  await expect(salon).toHaveURL(/\/requests\//);
  const requestUrl = salon.url();
  await expect(
    salon.getByRole("button", { name: "Approve request", exact: true }),
  ).toHaveCount(0);
  await login(hq, "hq");
  await expect(
    hq.getByRole("heading", { name: "Request queue", exact: true }),
  ).toBeVisible();
  await hq.goto(requestUrl);
  await confirm(hq, "Approve request");
  await expect(
    hq.getByText("Approved · reserved", { exact: true }).first(),
  ).toBeVisible();
  await confirm(hq, "Confirm dispatch");
  await expect(hq.getByTestId("hq-on-hand")).toHaveText("16");
  await expect(hq.getByTestId("in-transit")).toHaveText("2");
  await expect(
    hq.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toHaveCount(0);
  await salon.reload();
  await salon
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  const dialog = salon.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("All products are intact").check();
  await dialog.getByLabel("Received quantity").fill("1");
  await expect(
    dialog.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Received quantity").fill("2");
  expect(
    (
      await new AxeBuilder({ page: salon })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(salon.getByTestId("salon-on-hand")).toHaveText("4");
  await expect(salon.getByTestId("in-transit")).toHaveText("0");
  for (const width of [1280, 360, 320]) {
    await salon.setViewportSize({ width, height: 900 });
    if (width < 760) {
      await expect(
        salon.getByRole("navigation", { name: "Main navigation" }),
      ).toBeHidden();
      await expect
        .poll(async () => (await salon.locator("main").boundingBox())!.width)
        .toBeGreaterThanOrEqual(width - 1);
    }
    expect(
      await salon.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await salon.screenshot({
    path: "artifacts/replenishment-received-mobile.png",
    fullPage: true,
  });
  await salon.goto(`/salons/${encodeURIComponent(h.legnickaId)}`);
  await expect(salon.getByTestId("stock-NBS-MATOWA-100")).toHaveText("4");
  await expect(salon.getByTestId("low-stock-NBS-MATOWA-100")).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page: salon })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const result = await h.operator.executeGraphql<
    {
      stockMovements: { quantity: number }[];
      inventories: { onHand: number; reserved: number }[];
    },
    Record<string, string>
  >(
    'query($id:String!){stockMovements(where:{businessId:{eq:$id}}){quantity}inventories(where:{location:{businessId:{eq:$id},kind:{eq:HQ}},product:{demoId:{eq:"NBS-MATOWA-100"}}}){onHand reserved}}',
    { variables: { id: h.businessId } },
  );
  expect(result.data.stockMovements).toHaveLength(2);
  expect(result.data.inventories[0]).toEqual({ onHand: 16, reserved: 0 });
  await salonContext.close();
  await hqContext.close();
});
test("three_product_batch_survives_lost_response_and_refresh", async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page, "legnicka");
  await expect(
    page.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  for (const name of ["Pomada Dry Matt", "Pomada Cement", "Sól Morska"]) {
    await page
      .getByRole("button", { name: `Request ${name}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add to list", exact: true })
      .click();
  }
  let intercepted = false;
  const keys: string[] = [];
  await page.route("**/europe-west1/submitRequest", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(JSON.parse(route.request().postData()!).data.idempotencyKey);
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Submit requests", exact: true })
    .click();
  await expect(page.getByText("2 pcs · UNKNOWN")).toBeVisible({
    timeout: 15000,
  });
  expect(keys).toHaveLength(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Reconcile saved requests", exact: true })
    .click();
  await expect(page.getByText("2 pcs · CREATED")).toHaveCount(3, {
    timeout: 20000,
  });
  expect(keys).toHaveLength(4);
  expect(keys[0]).toBe(keys[1]);
  expect(new Set(keys).size).toBe(3);
  await page
    .getByRole("button", { name: "Request Pomada Dry Matt", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  await expect(
    page.getByText("Already requested. Open the active request below."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reconcile saved requests", exact: true }),
  ).toHaveCount(0);
  const count = await h.operator.executeGraphql(
    "query($id:String!){replenishmentRequests(where:{businessId:{eq:$id},state:{eq:PENDING_APPROVAL}}){_count}}",
    { variables: { id: h.businessId } },
  );
  expect(count.data).toEqual({ replenishmentRequests: [{ _count: 3 }] });
});
test("stale_approval_requires_review_and_rejection_requires_reason", async ({
  page,
}) => {
  await login(page, "hq");
  await expect(
    page.getByRole("heading", { name: "Request queue", exact: true }),
  ).toBeVisible();
  const row = page.locator("article").filter({ hasText: "Pomada Dry Matt" });
  await row.getByRole("link", { name: "Open request" }).click();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await h.operator.executeGraphql(
    "mutation($id:String!,$p:String!){inventory_update(key:{locationId:$id,productId:$p},data:{version_update:{inc:1}})}",
    {
      variables: {
        id: `${h.businessId}:hq`,
        p: `${h.businessId}:NBS-DRYMATT-100`,
      },
    },
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText(
      "The request or stock changed. Review the refreshed details before trying again.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reject request", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Reject request", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Reason for rejection")
    .fill("Please verify the salon count.");
  await dialog
    .getByRole("button", { name: "Reject request", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Please verify the salon count.")).toBeVisible();
});
test("saved_batch_links_back_to_its_salon_before_reconciliation", async ({
  page,
}) => {
  await h.operator.executeGraphql(
    "mutation($uid:String!,$id:String!){salonAccess_upsert(data:{membershipUid:$uid,locationId:$id})}",
    { variables: { uid: h.users.legnicka, id: `${h.businessId}:lodzka` } },
  );
  await login(page, "legnicka");
  await expect(
    page.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Request Olejek do brody | Savage",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Add to list", exact: true }).click();
  let lost = false;
  await page.route("**/europe-west1/submitRequest", async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Submit requests", exact: true })
    .click();
  await expect(page.getByText("2 pcs · UNKNOWN")).toBeVisible();
  await page.goto(`/salons/${encodeURIComponent(h.businessId + ":lodzka")}`);
  await expect(
    page.getByRole("heading", { name: "Łódzka", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reconcile saved requests", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Open Legnicka to reconcile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Legnicka", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reconcile saved requests", exact: true })
    .click();
  await expect(page.getByText("2 pcs · CREATED")).toBeVisible();
});
