import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let requestId: string;
let release: (() => void) | undefined;
let measurements: { route: string; width: number; overflow: number }[];
let calls: number;
const question = 'Which procedure covers this delivery?';

async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const credentials = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: role === 'hq' ? 'Salon requests' : 'Legnicka', exact: true }),
  ).toBeVisible();
}

async function mockAnswer(page: Page, body: unknown, status = 200, held = false) {
  const gate = held
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  await page.route('**/ai', async (route) => {
    const headers = {
      'access-control-allow-origin': new URL(page.url()).origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (
      route.request().method() !== 'POST' ||
      route.request().postDataJSON()?.data?.op !== 'answerProcedureQuestion'
    )
      return route.fallback();
    calls++;
    await gate;
    await route.fulfill({
      status,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function inspectRoute(page: Page, route: string, ready: () => Promise<void>, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route);
  await ready();
  measurements.push({
    route,
    width,
    overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  });
}

test.describe('Feature: approved demo interface states', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('UI state checks require isolated local Auth/SQL fixtures');
    h = await createCloudHarness('ui-states');
    const result = await new StockRepository(h.operator).execute(h.users.legnicka, {
      type: 'SUBMIT',
      input: {
        salonId: h.legnickaId,
        idempotencyKey: randomUUID(),
        items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      },
    });
    requestId = result.requestId;
    measurements = [];
    calls = 0;
    release = undefined;
  });
  test.afterEach(async () => {
    release?.();
    if (h) await h.dispose();
  });

  test.describe('Given a salon member with one pending request', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'legnicka');
    });
    test.describe('When they visit their routes at 320, 360 and 1280 pixels', () => {
      test.beforeEach(async ({ page }) => {
        for (const width of [320, 360, 1280]) {
          await inspectRoute(
            page,
            `/salons/${h.legnickaId}`,
            () => expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2'),
            width,
          );
          await inspectRoute(
            page,
            `/salons/${h.legnickaId}/requests`,
            () =>
              expect(page.getByRole('link', { name: 'Open request', exact: true })).toBeVisible(),
            width,
          );
          await inspectRoute(
            page,
            `/salons/${h.legnickaId}/requests/${requestId}`,
            () =>
              expect(
                page.getByRole('heading', { name: 'Delivery quantities', exact: true }),
              ).toBeVisible(),
            width,
          );
          await inspectRoute(
            page,
            `/salons/${h.legnickaId}/settings`,
            () => expect(page.getByLabel('Low-stock threshold')).toHaveValue('2'),
            width,
          );
          await inspectRoute(
            page,
            '/procedures',
            () =>
              expect(page.getByRole('textbox', { name: 'Question', exact: true })).toBeVisible(),
            width,
          );
          await inspectRoute(
            page,
            '/procedures?tab=documents',
            () =>
              expect(
                page.getByRole('heading', { name: 'No documents yet', exact: true }),
              ).toBeVisible(),
            width,
          );
        }
        await page.screenshot({
          path: '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/salon-routes.png',
          fullPage: true,
        });
      });
      test('Then all salon routes fit without horizontal page scrolling', () => {
        expect(measurements).toHaveLength(18);
        expect(measurements.filter((m) => m.overflow > 0)).toEqual([]);
      });
    });
    test.describe('When they inspect a pending request and the document library', () => {
      let privileged: number[];
      test.beforeEach(async ({ page }) => {
        await page.goto(`/salons/${h.legnickaId}/requests/${requestId}`);
        await expect(
          page.getByRole('heading', { name: 'Delivery quantities', exact: true }),
        ).toBeVisible();
        privileged = [
          await page.getByRole('button', { name: 'Approve request', exact: true }).count(),
          await page.getByRole('button', { name: 'Reject request', exact: true }).count(),
          await page.getByRole('button', { name: 'Confirm dispatch', exact: true }).count(),
        ];
        await page.goto('/procedures?tab=documents');
        await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
        privileged.push(
          await page.getByRole('button', { name: 'Add document', exact: true }).count(),
        );
      });
      test('Then HQ actions are absent rather than disabled', () => {
        expect(privileged).toEqual([0, 0, 0, 0]);
      });
    });
    test.describe('When they prepare a request in the desktop side panel', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
        await page.getByLabel('What do you need?').fill('2 Dry Matt');
      });
      test('Then preparation has no redundant hint and examples leave space before the action', async ({
        page,
      }) => {
        await expect(
          page.getByText('Prepare up to six items. Review the proposal before submitting.', {
            exact: true,
          }),
        ).toHaveCount(0);
        await expect
          .poll(async () => {
            const hint = await page
              .getByRole('group', { name: 'Request examples', exact: true })
              .boundingBox();
            const button = await page
              .getByRole('button', { name: 'Prepare proposal', exact: true })
              .boundingBox();
            return hint && button ? button.y - hint.y - hint.height : -1;
          })
          .toBeGreaterThanOrEqual(8);
        await page.screenshot({
          path: '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/hint-desktop.png',
          fullPage: true,
          animations: 'disabled',
        });
      });
    });
  });

  test.describe('Given an HQ member reviewing the same pending request', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'hq');
    });
    test.describe('When they inspect the HQ routes at 320 pixels', () => {
      test.beforeEach(async ({ page }) => {
        await inspectRoute(
          page,
          '/hq',
          () => expect(page.getByRole('link', { name: 'Open request', exact: true })).toBeVisible(),
          320,
        );
        await inspectRoute(
          page,
          '/hq/stock',
          () => expect(page.getByTestId('hq-stock-NBS-MATOWA-100')).toBeVisible(),
          320,
        );
        await inspectRoute(
          page,
          `/hq/requests/${requestId}`,
          () =>
            expect(
              page.getByRole('button', { name: 'Approve request', exact: true }),
            ).toBeVisible(),
          320,
        );
        await inspectRoute(
          page,
          '/procedures?tab=documents',
          () =>
            expect(
              page.getByRole('button', { name: 'Add document', exact: true }).first(),
            ).toBeVisible(),
          320,
        );
      });
      test('Then all HQ routes fit without horizontal page scrolling', () => {
        expect(measurements).toHaveLength(4);
        expect(measurements.filter((m) => m.overflow > 0)).toEqual([]);
      });
    });
    test.describe('When they open and dismiss an idle approval dialog with the keyboard', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 900 });
        await page.goto(`/hq/requests/${requestId}`);
        await page.getByRole('button', { name: 'Approve request', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
      });
      test('Then focus returns to the trigger and no stock is reserved', async ({ page }) => {
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(
          page.getByRole('button', { name: 'Approve request', exact: true }),
        ).toBeFocused();
        expect(await h.inventory()).toMatchObject({ hqOnHand: 18 });
        expect(
          (
            await h.operator.executeGraphql<
              { inventories: { reserved: number }[] },
              { product: string }
            >('query($product:String!){inventories(where:{productId:{eq:$product}}){reserved}}', {
              variables: { product: `${h.businessId}:NBS-MATOWA-100` },
            })
          ).data.inventories.every((row) => row.reserved === 0),
        ).toBe(true);
      });
    });
    test.describe('When they open and dismiss the document-upload dialog with the keyboard', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 900 });
        await page.goto('/procedures?tab=documents');
        await page.getByRole('button', { name: 'Add document', exact: true }).first().focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
      });
      test('Then focus returns to Add document without uploading a file', async ({ page }) => {
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(
          page.getByRole('button', { name: 'Add document', exact: true }).first(),
        ).toBeFocused();
        await expect(
          page.getByRole('heading', { name: 'No documents yet', exact: true }),
        ).toBeVisible();
      });
    });
  });

  for (const state of [
    {
      name: 'insufficient evidence',
      body: {
        result: {
          status: 'INSUFFICIENT_EVIDENCE',
          message: 'No eligible source supports this question.',
          sources: [],
        },
      },
      text: 'No supported answer',
      status: 200,
    },
    {
      name: 'clarification',
      body: {
        result: {
          status: 'NEEDS_CLARIFICATION',
          question: 'Is the product damaged or missing?',
          sources: [],
        },
      },
      text: 'More detail needed',
      status: 200,
    },
    {
      name: 'source changed',
      body: {
        error: {
          status: 'ABORTED',
          message: 'SOURCE_CHANGED',
          details: { code: 'SOURCE_CHANGED' },
        },
      },
      text: 'The sources changed. Please ask again.',
      status: 409,
    },
    {
      name: 'provider unavailable',
      body: {
        error: {
          status: 'UNAVAILABLE',
          message: 'PROVIDER_UNAVAILABLE',
          details: { code: 'PROVIDER_UNAVAILABLE' },
        },
      },
      text: 'The assistant is temporarily unavailable. Please try again.',
      status: 503,
    },
  ]) {
    test.describe(`Given controlled RAG ${state.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await mockAnswer(page, state.body, state.status);
        await login(page, 'legnicka');
        await page.goto('/procedures');
      });
      test.describe('When they ask a question at 320 pixels', () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 900 });
          await page.getByRole('textbox', { name: 'Question', exact: true }).fill(question);
          await page.getByRole('button', { name: 'Ask assistant', exact: true }).click();
        });
        test('Then the honest state retains the question without a fabricated answer', async ({
          page,
        }) => {
          await expect(page.getByText(state.text, { exact: true })).toBeVisible();
          await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toHaveValue(
            question,
          );
          await expect(page.getByRole('heading', { name: 'What to do', exact: true })).toHaveCount(
            0,
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        });
      });
    });
  }
  test.describe('Given a controlled pending RAG response', () => {
    test.beforeEach(async ({ page }) => {
      await mockAnswer(
        page,
        { result: { status: 'INSUFFICIENT_EVIDENCE', message: 'No evidence.', sources: [] } },
        200,
        true,
      );
      await login(page, 'legnicka');
      await page.goto('/procedures');
    });
    test.describe('When they submit a question', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('textbox', { name: 'Question', exact: true }).fill(question);
        await page.getByRole('button', { name: 'Ask assistant', exact: true }).click();
      });
      test('Then actual loading is announced and duplicate submission is blocked', async ({
        page,
      }) => {
        await expect(page.getByRole('status')).toHaveText(
          'Looking for supporting procedure sources…',
        );
        await expect(
          page.getByRole('button', { name: 'Ask assistant', exact: true }),
        ).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
        expect(calls).toBe(1);
      });
    });
  });
});
