import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { test, expect, type Page } from './test.ts';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import type { RequestState } from '../../shared/contracts/stock/index.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
const evidence = '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/request-design';
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: role === 'hq' ? 'Salon requests' : 'Legnicka', exact: true }),
  ).toBeVisible();
}

test.describe('Feature: original request detail layout', () => {
  test.beforeEach(async () => {
    test.setTimeout(60000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Isolated local fixtures only');
    h = await createCloudHarness('request-design');
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  for (const state of [
    'PENDING_APPROVAL',
    'RESERVED',
    'DISPATCHED',
    'RECEIVED',
    'REJECTED',
  ] as RequestState[]) {
    test.describe(`Given a ${state} request`, () => {
      const role = state === 'PENDING_APPROVAL' || state === 'RESERVED' ? 'hq' : 'legnicka';
      let id: string;
      test.beforeEach(async ({ page }) => {
        const repo = new StockRepository(h.operator);
        const productId = `${h.businessId}:NBS-MATOWA-100`;
        let result = await repo.execute(h.users.legnicka, {
          type: 'SUBMIT',
          input: {
            salonId: h.legnickaId,
            idempotencyKey: randomUUID(),
            items: [{ productId, quantity: 2 }],
          },
        });
        id = result.requestId;
        if (state === 'REJECTED')
          result = await repo.execute(h.users.hq, {
            type: 'REJECT',
            input: {
              requestId: id,
              expectedRevision: result.revision,
              idempotencyKey: randomUUID(),
              reason: 'Check the salon count before requesting again.',
            },
          });
        else if (state !== 'PENDING_APPROVAL') {
          result = await repo.execute(h.users.hq, {
            type: 'APPROVE',
            input: {
              requestId: id,
              expectedRevision: result.revision,
              idempotencyKey: randomUUID(),
              inventoryVersions: [{ productId, expectedHqInventoryVersion: 1 }],
            },
          });
          if (state !== 'RESERVED')
            result = await repo.execute(h.users.hq, {
              type: 'DISPATCH',
              input: {
                requestId: id,
                expectedRevision: result.revision,
                idempotencyKey: randomUUID(),
              },
            });
          if (state === 'RECEIVED')
            await new DeliveryRepository(h.operator).execute(h.users.legnicka, {
              type: 'RECORD_RECEIPT',
              input: {
                requestId: id,
                expectedRevision: result.revision,
                idempotencyKey: randomUUID(),
                items: [{ productId, goodQuantity: 2, damagedQuantity: 0, missingQuantity: 0 }],
                procedureReferences: [],
              },
            });
        }
        await login(page, role);
        if (state === 'PENDING_APPROVAL' || state === 'REJECTED') {
          await page.goto(
            role === 'hq'
              ? '/hq?offset=0'
              : `/salons/${h.legnickaId}/requests?filter=REJECTED&offset=0`,
          );
          await page.getByRole('link', { name: 'Open request', exact: true }).click();
        } else {
          await page.goto(
            role === 'hq' ? `/hq/requests/${id}` : `/salons/${h.legnickaId}/requests/${id}`,
          );
        }
        await expect(
          page.getByRole('heading', { name: 'Delivery quantities', exact: true }),
        ).toBeVisible();
      });
      if (state === 'PENDING_APPROVAL' || state === 'REJECTED') {
        test.describe('When they follow the return button using the keyboard', () => {
          test.beforeEach(async ({ page }) => {
            await page
              .getByRole('button', {
                name: role === 'hq' ? 'Back to request queue' : 'Back to requests',
                exact: true,
              })
              .focus();
            await page.keyboard.press('Enter');
          });
          test('Then the authorized original list and its filter are restored', async ({
            page,
          }) => {
            await expect(page).toHaveURL((url) =>
              role === 'hq'
                ? url.pathname === '/hq' && url.searchParams.get('offset') === '0'
                : decodeURIComponent(url.pathname) === `/salons/${h.legnickaId}/requests` &&
                  url.searchParams.get('filter') === 'REJECTED' &&
                  url.searchParams.get('offset') === '0',
            );
          });
        });
      }
      test.describe('When the detail is shown at desktop and mobile widths', () => {
        let metrics: {
          width: number;
          overflow: number;
          backHeight: number;
          statusWithTitle: boolean;
        }[];
        test.beforeEach(async ({ page }) => {
          await expect(
            page.getByRole('heading', { name: 'Status history', exact: true }),
          ).toBeVisible({ timeout: 3000 });
          metrics = [];
          for (const width of [1280, 320]) {
            await page.setViewportSize({ width, height: 1000 });
            const back = page.getByRole('button', {
              name: role === 'hq' ? 'Back to request queue' : 'Back to requests',
              exact: true,
            });
            await back.scrollIntoViewIfNeeded();
            const backBox = (await back.boundingBox())!;
            const title = (await page.locator('.request-header h1').boundingBox())!;
            const status = (await page.locator('.request-header app-status-chip').boundingBox())!;
            metrics.push({
              width,
              overflow: await page.evaluate(
                () => document.documentElement.scrollWidth - innerWidth,
              ),
              backHeight: backBox.height,
              statusWithTitle: width < 760 || status.x > title.x,
            });
            await page.screenshot({
              path: `${evidence}/${state}-${width}.png`,
              fullPage: true,
              animations: 'disabled',
            });
          }
          await page
            .getByRole('heading', { name: 'Status history', exact: true })
            .scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${evidence}/${state}-history-320.png`,
            fullPage: true,
            animations: 'disabled',
          });
        });
        test('Then the title, state, separated sections and honest vertical history follow the design', async ({
          page,
        }) => {
          await expect(page.locator('.request-header h1')).toContainText('Pomada Matowa');
          await expect(page.locator('.request-header app-status-chip')).toBeVisible();
          const history = page.getByRole('list', { name: 'Request status history', exact: true });
          await expect(history.getByRole('listitem')).toHaveCount(state === 'REJECTED' ? 2 : 4);
          const recorded = {
            PENDING_APPROVAL: 1,
            RESERVED: 2,
            DISPATCHED: 3,
            RECEIVED: 4,
            RECEIVED_WITH_ISSUE: 4,
            REJECTED: 2,
          }[state];
          await expect(history.locator('.recorded')).toHaveCount(recorded);
          await expect(history.locator('.pending')).toHaveCount(
            state === 'REJECTED' ? 0 : 4 - recorded,
          );
          if (state === 'REJECTED')
            await expect(history).toContainText('Check the salon count before requesting again.');
          await expect(page.locator('.figures')).toHaveCount(1);
          expect(metrics.every((m) => m.overflow <= 0 && m.statusWithTitle)).toBe(true);
          expect(metrics.find((m) => m.width === 1280)!.backHeight).toBe(40);
          expect(metrics.find((m) => m.width === 320)!.backHeight).toBeGreaterThanOrEqual(48);
        });
      });
    });
  }
});
