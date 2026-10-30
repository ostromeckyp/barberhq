import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import { seedPdfViewerSource } from './pdf-viewer.fixture.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let release = () => {};
const evidence = '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/remaining-states';

async function login(page: Page) {
  await page.goto('/login');
  const credentials = h.loginCredentials('hq');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salon requests', exact: true })).toBeVisible();
}

async function pendingRequest() {
  return new StockRepository(h.operator).execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      idempotencyKey: randomUUID(),
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
    },
  });
}

async function holdRead(page: Page, operation: string) {
  let mode: 'hold' | 'fail' | 'pass' = 'hold';
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**:9399/**', async (route) => {
    if (!route.request().postData()?.includes(operation)) return route.continue();
    if (mode === 'hold') await gate;
    if (mode === 'fail') await route.abort();
    else await route.continue();
  });
  return (next: 'fail' | 'pass') => {
    mode = next;
    release();
  };
}

async function capture(page: Page, state: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `${evidence}/${state}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

test.describe('Feature: honest failure and recovery states', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Local isolated Auth/SQL fixtures only');
    h = await createCloudHarness('ui-failures');
    release = () => {};
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page);
  });
  test.afterEach(async ({ page }) => {
    release();
    await page.unrouteAll({ behavior: 'wait' });
    if (h) await h.dispose();
  });

  test.describe('Given an empty HQ queue', () => {
    test.describe('When the initial read is held then fails and is retried', () => {
      test('Then actual loading and error recover to the honest empty queue', async ({ page }) => {
        const resume = await holdRead(page, 'ListHQQueue');
        await page.goto('/hq?offset=0');
        await expect(page.getByRole('progressbar', { name: 'Loading requests' })).toBeVisible();
        await capture(page, 'queue-loading-320');
        resume('fail');
        await expect(page.getByRole('alert')).toContainText('Requests unavailable');
        await capture(page, 'queue-error-320');
        resume('pass');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.getByText('No requests in this section.', { exact: true })).toHaveCount(
          2,
        );
        await capture(page, 'queue-empty-320');
      });
    });
  });

  test.describe('Given a pending request', () => {
    test.describe('When the detail read is held then fails and is retried', () => {
      test('Then no quantity is invented and the real request is recovered', async ({ page }) => {
        const request = await pendingRequest();
        const resume = await holdRead(page, 'GetRequestDetail');
        await page.goto(`/hq/requests/${request.requestId}`);
        await expect(page.getByRole('progressbar', { name: 'Loading request' })).toBeVisible();
        await expect(page.locator('.figures')).toHaveCount(0);
        await capture(page, 'detail-loading-320');
        resume('fail');
        await expect(page.getByRole('heading', { name: 'Request unavailable' })).toBeVisible();
        await expect(page.locator('.figures')).toHaveCount(0);
        await capture(page, 'detail-error-320');
        resume('pass');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByRole('heading', { name: /^Pomada Matowa/, level: 1 })).toBeVisible();
        await expect(page.locator('.figures strong').first()).toHaveText('2');
      });
    });

    test.describe('When an approval is held, loses its result and is retried', () => {
      test('Then busy dismissal is blocked and the retry retains the same command identity', async ({
        page,
      }) => {
        const request = await pendingRequest();
        const commands: unknown[] = [];
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/europe-west1/approveRequest', async (route) => {
          const headers = {
            'access-control-allow-origin': new URL(page.url()).origin,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers':
              'authorization, content-type, x-firebase-appcheck, firebase-instance-id-token',
          };
          if (route.request().method() === 'OPTIONS')
            return route.fulfill({ status: 204, headers });
          commands.push(route.request().postDataJSON().data);
          if (commands.length === 1) {
            await gate;
            await route.abort();
          } else {
            await route.fulfill({
              status: 409,
              headers,
              contentType: 'application/json',
              body: JSON.stringify({
                error: {
                  status: 'ABORTED',
                  message: 'Controlled stale state',
                  details: { code: 'STALE_STATE' },
                },
              }),
            });
          }
        });
        await page.goto(`/hq/requests/${request.requestId}`);
        await page.getByRole('button', { name: 'Approve request', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('button', { name: 'Approve request', exact: true }).click();
        await expect(dialog.getByRole('progressbar', { name: 'Saving action' })).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        await capture(page, 'approval-busy-320');
        release();
        await expect(dialog.getByRole('alert')).toContainText('Outcome unknown');
        await expect(dialog.getByRole('button', { name: 'Retry same action' })).toBeEnabled();
        await capture(page, 'approval-unknown-320');
        await dialog.getByRole('button', { name: 'Retry same action' }).focus();
        await page.keyboard.press('Enter');
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('status')).toContainText('request or stock changed');
        expect(commands).toHaveLength(2);
        expect(commands[0]).toEqual(commands[1]);
        const result = await h.client('legnicka').getSalonInventory(h.legnickaId);
        expect(
          result.inventory?.find((row) => row.product.id.endsWith(':NBS-MATOWA-100')),
        ).toMatchObject({ onHand: 2, reserved: 0 });
        await expect(page.getByText('Pending approval', { exact: true })).toBeVisible();
        await capture(page, 'approval-stale-320');
      });
    });
  });

  test.describe('Given an empty document library', () => {
    test.describe('When its read is held then fails and is retried', () => {
      test('Then loading and error do not masquerade as an empty result', async ({ page }) => {
        const resume = await holdRead(page, 'ListHqKnowledgeDocuments');
        await page.goto('/procedures?tab=documents');
        await expect(page.getByRole('status')).toContainText('Loading documents');
        await expect(page.getByRole('heading', { name: 'No documents yet' })).toHaveCount(0);
        await capture(page, 'library-loading-320');
        resume('fail');
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'No documents yet' })).toHaveCount(0);
        await capture(page, 'library-error-320');
        resume('pass');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'No documents yet' })).toBeVisible();
      });
    });
  });

  test.describe('Given an authorized PDF source', () => {
    test.describe('When download fails, bytes are corrupt and the read is retried', () => {
      test('Then errors retain a usable Back and retry recovers the original PDF', async ({
        page,
      }) => {
        const source = await seedPdfViewerSource(h);
        let mode: 'fetch' | 'corrupt' | 'valid' = 'fetch';
        await page.route('**/getSourcePdf?*', (route) =>
          route.fulfill({
            status: mode === 'fetch' ? 503 : 200,
            contentType: 'application/pdf',
            body:
              mode === 'valid'
                ? source.bytes
                : Buffer.from('%PDF-1.7\nCorrupted PDF with no trailer'),
          }),
        );
        await page.goto(`/procedures/sources/${encodeURIComponent(source.versionId)}`);
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Back to Procedures', exact: true }),
        ).toBeEnabled();
        await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(0);
        await capture(page, 'pdf-fetch-error-320');
        mode = 'corrupt';
        const corruptRead = page.waitForResponse('**/getSourcePdf?*');
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await corruptRead;
        await expect(page.getByRole('alert')).toContainText('Source could not be opened');
        await capture(page, 'pdf-corrupt-error-320');
        mode = 'valid';
        await page.getByRole('button', { name: 'Retry', exact: true }).click();
        await expect(page.getByTestId('pdf-page-canvas')).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
        expect((await download).suggestedFilename()).toContain('v1.pdf');
        await page.getByRole('button', { name: 'Back to Procedures', exact: true }).click();
        await expect(page).toHaveURL(/\/procedures\?tab=documents$/);
      });
    });
  });

  test.describe('Given an HQ member acting for a salon', () => {
    test.describe('When a manual draft requests more units than HQ has available', () => {
      test('Then the warning is readable, submission remains explicit and stock is unchanged', async ({
        page,
      }) => {
        const stock = async () =>
          (
            await h.operator.executeGraphql(
              'query($product:String!){inventories(where:{productId:{eq:$product}},orderBy:[{locationId:ASC}]){locationId onHand reserved version}}',
              { variables: { product: `${h.businessId}:NBS-MATOWA-100` } },
            )
          ).data;
        const before = await stock();
        await page.getByRole('combobox', { name: 'Workspace', exact: true }).click();
        await page.getByRole('option', { name: 'Salon — Legnicka', exact: true }).click();
        await page.getByRole('button', { name: 'Request Pomada Matowa', exact: true }).click();
        const sheet = page.getByRole('dialog', { name: 'Request products', exact: true });
        await sheet.getByLabel('Quantity', { exact: true }).fill('99');
        await sheet.getByRole('button', { name: 'Add to list', exact: true }).click();
        await expect(sheet.getByText(/HQ has 18 available/)).toBeVisible();
        await expect(
          sheet.getByRole('button', { name: 'Submit request', exact: true }),
        ).toBeEnabled();
        await capture(page, 'draft-shortage-320');
        await page.keyboard.press('Escape');
        expect(await h.inventory()).toMatchObject({ hqOnHand: 18 });
        expect(await stock()).toEqual(before);
      });
    });
  });
});
