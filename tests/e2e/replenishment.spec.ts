import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeEach(async () => {
  h = await createCloudHarness('replenishment-ui');
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: role === 'hq' ? 'Salon requests' : 'Legnicka',
      exact: true,
    }),
  ).toBeVisible();
}
async function add(page: Page, name: string, quantity = 2) {
  await page.getByRole('button', { name: `Request ${name}`, exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill(String(quantity));
  await page.getByRole('button', { name: 'Add to list', exact: true }).click();
}
async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(page.getByText('Request submitted.', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Open request', exact: true }).click();
  await expect(page).toHaveURL(/\/requests\//);
  return page.url();
}
async function confirm(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const d = page.getByRole('dialog');
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: label, exact: true }).click();
  await expect(d).toBeHidden({ timeout: 20000 });
}
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
}
for (const many of [false, true])
  test(`${many ? 'three_products' : 'two_units'}_move_once_and_incomplete_inspection_blocks_submission`, async ({
    browser,
  }) => {
    test.setTimeout(60000);
    const salonContext = await browser.newContext(),
      hqContext = await browser.newContext();
    const salon = await salonContext.newPage(),
      hq = await hqContext.newPage();
    await login(salon, 'legnicka');
    const products = many
      ? ([
          ['Pomada Matowa', 2],
          ['Pomada Dry Matt', 3],
          ['Pomada Cement', 1],
        ] as const)
      : ([['Pomada Matowa', 2]] as const);
    for (const [name, q] of products) await add(salon, name, q);
    const url = await submit(salon);
    await login(hq, 'hq');
    await expect(hq.locator('tr.request-row')).toHaveCount(1);
    await hq.goto(`/hq/requests/${url.split('/').at(-1)}`);
    await confirm(hq, 'Approve request');
    await confirm(hq, 'Confirm dispatch');
    await expect(hq.getByTestId('hq-on-hand')).toHaveCount(products.length);
    await salon.reload();
    await salon.getByRole('button', { name: 'Check delivery', exact: true }).click();
    const button = salon.getByRole('button', { name: 'Record inspection', exact: true });
    await expect(button).toBeDisabled();
    for (const [name, q] of products)
      await salon
        .getByRole('spinbutton', { name: `Good units · ${name}`, exact: true })
        .fill(String(q));
    await salon
      .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
      .fill('1');
    await expect(button).toBeDisabled();
    await expect(salon.getByText(/quantities must add up to 2/)).toBeVisible();
    await salon
      .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
      .fill('2');
    await accessible(salon);
    await button.click();
    await salon.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
    await salon.getByRole('button', { name: 'Back to request', exact: true }).click();
    await expect(salon.getByTestId('in-transit')).toHaveText(products.map(() => '0'));
    const snapshot = await h.operator.executeGraphql<
      {
        stockMovements: { quantity: number }[];
        replenishmentRequests: { id: string }[];
        inventories: {
          locationId: string;
          productId: string;
          onHand: number;
          reserved: number;
        }[];
        actionReceipts: { action: string }[];
        deliveryReceipts: { id: string }[];
      },
      Record<string, string>
    >(
      'query($id:String!){stockMovements(where:{businessId:{eq:$id}}){quantity}replenishmentRequests(where:{businessId:{eq:$id}}){id}inventories(where:{location:{businessId:{eq:$id}}}){locationId productId onHand reserved}actionReceipts(where:{businessId:{eq:$id}}){action}deliveryReceipts(where:{businessId:{eq:$id}}){id}}',
      { variables: { id: h.businessId } },
    );
    expect(snapshot.data.replenishmentRequests).toHaveLength(1);
    expect(snapshot.data.stockMovements).toHaveLength(products.length * 2);
    expect(snapshot.data.actionReceipts).toHaveLength(3);
    expect(snapshot.data.deliveryReceipts).toHaveLength(1);
    const ids = many ? ['NBS-MATOWA-100', 'NBS-DRYMATT-100', 'NBS-CEMENT-100'] : ['NBS-MATOWA-100'];
    ids.forEach((id, i) => {
      expect(
        snapshot.data.inventories.find(
          (r) => r.productId === `${h.businessId}:${id}` && r.locationId === `${h.businessId}:hq`,
        ),
      ).toMatchObject({ onHand: 18 - products[i][1], reserved: 0 });
      expect(
        snapshot.data.inventories.find(
          (r) => r.productId === `${h.businessId}:${id}` && r.locationId === h.legnickaId,
        ),
      ).toMatchObject({ onHand: 2 + products[i][1] });
    });
    for (const width of [1280, 360, 320]) {
      await salon.setViewportSize({ width, height: 900 });
      expect(await salon.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await accessible(salon);
    }
    await salon.screenshot({
      path: `artifacts/request-${many ? 'three' : 'one'}-mobile.png`,
      fullPage: true,
    });
    await salonContext.close();
    await hqContext.close();
  });
test('one_three_item_request_survives_committed_lost_response', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, 'legnicka');
  for (const name of ['Pomada Matowa', 'Pomada Dry Matt', 'Pomada Cement']) await add(page, name);
  let lost = false;
  const keys: string[] = [];
  await page.route('**/commands', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const { op, input } = JSON.parse(route.request().postData()!).data;
    if (op !== 'submitRequest') return route.fallback();
    keys.push(input.idempotencyKey);
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(
    page.getByText('We could not confirm the request. Check your request list.', { exact: true }),
  ).toBeVisible({
    timeout: 20000,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Reconcile saved request', exact: true }).click();
  await expect(page.getByText('Request submitted.', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  const rows = await h.operator.executeGraphql(
    'query($id:String!){replenishmentRequests(where:{businessId:{eq:$id}}){id items:requestItems_on_request{quantity}}}',
    { variables: { id: h.businessId } },
  );
  expect((rows.data as { replenishmentRequests: unknown[] }).replenishmentRequests).toHaveLength(1);
  await page.getByRole('link', { name: 'View requests', exact: true }).click();
  await expect(page.locator('tr.request-row')).toHaveCount(1);
  await expect(page.locator('tr.request-row')).toContainText('3 items');
});
test('rejected_request_retains_reason_history_and_safe_back_context', async ({ page }) => {
  const repo = new StockRepository(h.operator);
  const r = await repo.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await login(page, 'hq');
  await page.locator('tr.request-row').getByRole('link', { name: 'Open request' }).click();
  await page.getByRole('button', { name: 'Approve request', exact: true }).click();
  await h.operator.executeGraphql(
    'mutation($id:String!,$p:String!){inventory_update(key:{locationId:$id,productId:$p},data:{version_update:{inc:1}})}',
    {
      variables: {
        id: `${h.businessId}:hq`,
        p: `${h.businessId}:NBS-MATOWA-100`,
      },
    },
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Approve request', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByText(
      'The request or stock changed. Review the refreshed details before trying again.',
    ),
  ).toBeVisible();
  const trigger = page.getByRole('button', {
    name: 'Reject request',
    exact: true,
  });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  const d = page.getByRole('dialog');
  await expect(d.getByRole('button', { name: 'Reject request', exact: true })).toBeDisabled();
  await d.getByLabel('Reason for rejection').fill('Please verify the salon count.');
  await d.getByRole('button', { name: 'Reject request', exact: true }).click();
  await expect(d).toBeHidden();
  await page.getByRole('button', { name: 'Back to request queue' }).click();
  await expect(page).toHaveURL(/\/hq/);
  await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}/requests`);
  await expect(page.locator('tr.request-row')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Rejected', exact: true }).click();
  await page.locator('tr.request-row').getByRole('link', { name: 'Open request' }).click();
  await expect(page.getByText('Please verify the salon count.')).toBeVisible();
  await page.getByRole('button', { name: 'Requests' }).click();
  await expect(page).toHaveURL(/filter=REJECTED/);
  await accessible(page);
  expect((await h.inventory()).hqOnHand).toBe(18);
  const salonStock = await h.client('legnicka').getSalonInventory(h.legnickaId);
  expect(salonStock.inventory?.find((row) => row.product.demoId === 'NBS-MATOWA-100')?.onHand).toBe(
    2,
  );
});
