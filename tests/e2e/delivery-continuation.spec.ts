import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  createDeliveryHarness,
  seedDispatchedDelivery,
  executeDelivery,
  readDeliverySnapshot,
  type DeliveryHarness,
  type DeliverySnapshot,
} from '../support/delivery.ts';
import { seedDeliveryPdf } from '../support/delivery-knowledge.ts';
let h: DeliveryHarness;
let delivery: Awaited<ReturnType<typeof seedDispatchedDelivery>>;
let source: Awaited<ReturnType<typeof seedDeliveryPdf>>;
let after: DeliverySnapshot;
let posted: unknown[];
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('heading', { name: role === 'hq' ? 'Salon requests' : 'Legnicka', exact: true })
    .waitFor();
}
async function openReceipt(page: Page) {
  await page.goto(`/salons/${h.legnickaId}/requests/${delivery.requestId}/receipt`);
  await page.getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true }).waitFor();
}
async function classify(page: Page, good: string, damaged: string) {
  await page
    .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
    .fill(good);
  await page
    .getByRole('spinbutton', { name: 'Damaged units · Pomada Matowa', exact: true })
    .fill(damaged);
  await page
    .getByRole('spinbutton', { name: 'Missing units · Pomada Matowa', exact: true })
    .fill('0');
}
async function returnFromPdf(page: Page, label: string) {
  await page.getByTestId('pdf-page-canvas').waitFor();
  await page.getByRole('button', { name: `Back to ${label}`, exact: true }).click();
}
async function createIssue(reference = true) {
  return executeDelivery(h, 'legnicka', {
    type: 'RECORD_RECEIPT',
    input: {
      requestId: delivery.requestId,
      expectedRevision: 3,
      idempotencyKey: randomUUID(),
      items: [
        {
          productId: delivery.items[0].productId,
          goodQuantity: 8,
          damagedQuantity: 2,
          missingQuantity: 0,
        },
      ],
      report: { description: 'Two damaged jars', batchIdentifier: null },
      procedureReferences: reference ? [{ kind: 'DAMAGED', versionId: source.versionId }] : [],
    },
  });
}
async function revoke() {
  await h.operator.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(key:{id:$id},data:{isActive:false,revokedAt:"2026-10-26T00:00:00Z"})}',
    { variables: { id: source.versionId } },
  );
}
test.describe('Feature: continue delivery work across procedures and interrupted commands', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(45000);
    h = undefined!;
    h = await createDeliveryHarness('delivery-continuation');
    source = await seedDeliveryPdf(h);
    delivery = await seedDispatchedDelivery(h);
    posted = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/commands')) {
        const { op, input } = request.postDataJSON().data;
        if (op === 'recordDeliveryReceipt' || op === 'setDeliveryProcedure')
          posted.push({ data: input });
      }
    });
    await page.route('**/getSourcePdf?*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: source.bytes }),
    );
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  test.describe('Given a procedure selected before reclassifying everything as good', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'legnicka');
      await openReceipt(page);
      await classify(page, '8', '2');
      await page.getByLabel('Describe the problem').fill('Two damaged jars');
      await page
        .getByRole('button', { name: 'Open damaged product procedure', exact: true })
        .click();
      await returnFromPdf(page, 'Check delivery');
      await classify(page, '10', '0');
      await revoke();
      await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
      await page
        .getByRole('status')
        .filter({ hasText: /source/i })
        .waitFor();
    });
    test.describe('When the withdrawn reference is explicitly removed and facts recorded', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Remove source reference', exact: true }).click();
        await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
        await page.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then all ten good units are recorded once without a stale reference', async () => {
        expect(after.receipts).toHaveLength(1);
        expect(after.salonInventory.onHand).toBe(12);
        expect(after.issues).toHaveLength(0);
      });
    });
  });
  test.describe('Given an issue whose inspection has no selected procedure', () => {
    test.beforeEach(async ({ page }) => {
      const result = await createIssue(false);
      await login(page, 'legnicka');
      await page.goto(`/salons/${h.legnickaId}/delivery-issues/${result.issueId}`);
    });
    test.describe('When staff consult the current assigned procedure', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('region', { name: 'Current delivery procedures', exact: true })
          .getByRole('button', { name: 'Open damaged product procedure', exact: true })
          .click();
        await page.getByTestId('pdf-page-canvas').waitFor();
      });
      test('Then the original PDF is available without changing inspection history', async ({
        page,
      }) => {
        await expect(
          page.getByRole('heading', { name: 'Delivery handling procedure', exact: true }),
        ).toBeVisible();
        expect(posted).toEqual([]);
      });
    });
  });
  test.describe('Given a revoked historical version and a published successor', () => {
    let historicalDenied: boolean;
    test.beforeEach(async ({ page }) => {
      const result = await createIssue();
      await revoke();
      await seedDeliveryPdf(h, 'v2');
      await login(page, 'legnicka');
      await page.goto(`/salons/${h.legnickaId}/delivery-issues/${result.issueId}`);
    });
    test.describe('When staff view the current and historical procedure sections', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('region', { name: 'Original inspection', exact: true })
          .getByRole('button', { name: 'Open damaged product procedure', exact: true })
          .click();
        await page.getByRole('alert').waitFor();
        historicalDenied = (await page.getByTestId('pdf-page-canvas').count()) === 0;
        await page.getByRole('button', { name: 'Back to Delivery issue', exact: true }).click();
        await page
          .getByRole('region', { name: 'Current delivery procedures', exact: true })
          .getByRole('button', { name: 'Open damaged product procedure', exact: true })
          .click();
        await page.getByTestId('pdf-page-canvas').waitFor();
      });
      test('Then the current version is distinct and the historical version still denies access', async ({
        page,
      }) => {
        await expect(
          page.getByRole('heading', { name: 'Current delivery procedure', exact: true }),
        ).toBeVisible();
        expect(historicalDenied).toBe(true);
      });
    });
  });
  test.describe('Given a salon request opened from ACTIVE page twenty', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'legnicka');
      await page.goto(`/salons/${h.legnickaId}/requests/${delivery.requestId}`);
      await page.evaluate(
        ({ salonId }) =>
          history.replaceState(
            {
              ...history.state,
              listContext: { kind: 'SALON', salonId, filter: 'ACTIVE', offset: 20 },
            },
            '',
          ),
        { salonId: h.legnickaId },
      );
      await page.reload();
      await page.getByRole('button', { name: 'Check delivery', exact: true }).click();
      await classify(page, '8', '2');
      await page
        .getByRole('button', { name: 'Open damaged product procedure', exact: true })
        .click();
    });
    test.describe('When staff return through receipt and request to the list', () => {
      test.beforeEach(async ({ page }) => {
        await returnFromPdf(page, 'Check delivery');
        await page.getByRole('button', { name: 'Back to request', exact: true }).click();
        await page.getByRole('button', { name: 'Back to requests', exact: true }).click();
      });
      test('Then the validated filter and page survive the entire round trip', async ({ page }) => {
        await expect(page).toHaveURL(new RegExp(`/requests\\?filter=ACTIVE&offset=20$`));
      });
    });
  });
  test.describe('Given an HQ issue opened from ALL page twenty', () => {
    test.beforeEach(async ({ page }) => {
      const result = await createIssue();
      await login(page, 'hq');
      await page.goto(`/hq/delivery-issues/${result.issueId}?issueStatus=ALL&issueOffset=20`);
      await page
        .getByRole('region', { name: 'Original inspection', exact: true })
        .getByRole('button', { name: 'Open damaged product procedure', exact: true })
        .click();
    });
    test.describe('When HQ returns through the PDF and issue to the list', () => {
      test.beforeEach(async ({ page }) => {
        await returnFromPdf(page, 'Delivery issue');
        await page.getByRole('button', { name: 'Back to delivery issues', exact: true }).click();
      });
      test('Then ALL and page twenty remain selected', async ({ page }) => {
        await expect(page).toHaveURL(/view=delivery-issues&issueStatus=ALL&issueOffset=20$/);
      });
    });
  });
  test.describe('Given a procedure save committed with a lost response', () => {
    test.beforeEach(async ({ page }) => {
      let lost = false;
      await page.route('**/commands', async (route) => {
        if (
          route.request().method() !== 'POST' ||
          route.request().postDataJSON().data.op !== 'setDeliveryProcedure' ||
          lost
        )
          return route.fallback();
        lost = true;
        await route.fetch();
        await route.fulfill({
          status: 503,
          json: { error: { status: 'UNAVAILABLE', message: 'Controlled lost response' } },
        });
      });
      await login(page, 'hq');
      await page.getByRole('radio', { name: /Delivery issues/ }).click();
      await page.getByRole('button', { name: 'Configure procedures', exact: true }).click();
      await page.getByRole('combobox', { name: 'Missing product', exact: true }).click();
      await page.getByRole('option', { name: /Delivery handling procedure/ }).click();
      await page.getByRole('button', { name: 'Save', exact: true }).nth(1).click();
      await page
        .getByText('Save outcome unknown. Retry with the same selection.', { exact: true })
        .waitFor();
    });
    test.describe('When HQ closes, reloads, reopens and retries the saved command', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.reload();
        await page.getByRole('button', { name: 'Configure procedures', exact: true }).click();
        await page.getByRole('button', { name: 'Retry save', exact: true }).click();
        await page.getByText('The earlier save was recorded.', { exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the same frozen key reconciles one setting audit', async () => {
        expect(posted).toHaveLength(2);
        expect(posted[1]).toEqual(posted[0]);
        expect(after.commands.filter((row) => row.type === 'SET_PROCEDURE')).toHaveLength(2);
      });
    });
  });
  test.describe('Given a committed inspection with a lost response followed by revoked salon access', () => {
    test.beforeEach(async ({ page }) => {
      let lost = false;
      await page.route('**/commands', async (route) => {
        if (
          route.request().method() !== 'POST' ||
          route.request().postDataJSON().data.op !== 'recordDeliveryReceipt' ||
          lost
        )
          return route.fallback();
        lost = true;
        await route.fetch();
        await route.fulfill({
          status: 503,
          json: { error: { status: 'UNAVAILABLE', message: 'Controlled lost response' } },
        });
      });
      await login(page, 'legnicka');
      await openReceipt(page);
      await classify(page, '8', '2');
      await page.getByLabel('Describe the problem').fill('Two damaged jars');
      await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
      await page.getByRole('button', { name: 'Retry saved inspection', exact: true }).waitFor();
      await h.operator.executeGraphql(
        'mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}',
        { variables: { uid: h.users.legnicka } },
      );
      await page.getByRole('button', { name: 'Retry saved inspection', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Access changed' }).waitFor();
    });
    test.describe('When access is restored and the same browser reloads and retries', () => {
      test.beforeEach(async ({ page }) => {
        await h.operator.executeGraphql(
          'mutation($uid:String!,$salon:String!){salonAccess_upsert(data:{membershipUid:$uid,locationId:$salon})}',
          { variables: { uid: h.users.legnicka, salon: h.legnickaId } },
        );
        await page.reload();
        await page.getByRole('button', { name: 'Retry saved inspection', exact: true }).click();
        await page.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the original payload reconciles one receipt and one stock effect', async () => {
        expect(posted).toHaveLength(3);
        expect(posted[1]).toEqual(posted[0]);
        expect(posted[2]).toEqual(posted[0]);
        expect(after.receipts).toHaveLength(1);
        expect(after.salonInventory.onHand).toBe(10);
        expect(after.movements.filter((row) => row.type === 'RECEIPT')).toHaveLength(1);
      });
    });
  });
});
