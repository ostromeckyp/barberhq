import { test, expect, type Page } from './test.ts';
import { createCloudHarness } from '../support/cloud.ts';
import type { ProposalResult } from '../../shared/contracts/ai/index.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
const dictated = '2 Matowa i 3 matte';

/** Replaces the microphone and recorder with deterministic stand-ins that yield a non-empty blob. */
async function fakeRecorder(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }),
      },
    });
    class FakeRecorder {
      static isTypeSupported = () => true;
      mimeType = 'audio/webm';
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() {
        this.state = 'recording';
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
      }
      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
  });
}

async function mockAi(page: Page, prepare: (calls: number) => ProposalResult) {
  let calls = 0;
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
    const op = route.request().postDataJSON()?.data?.op;
    if (
      route.request().method() !== 'POST' ||
      (op !== 'transcribeOrder' && op !== 'prepareReplenishment')
    )
      return route.fallback();
    const result = op === 'transcribeOrder' ? { text: dictated } : prepare(++calls);
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ result }),
    });
  });
}

const line = (id: string, product: string, name: string, extra = {}) =>
  ({
    status: 'READY',
    lineId: id,
    productId: `${h.businessId}:${product}`,
    productName: name,
    quantity: 2,
    origin: 'assistant',
    hqAvailable: 18,
    salonOnHand: 2,
    hqInventoryVersion: 1,
    salonInventoryVersion: 1,
    ...extra,
  }) as ProposalResult['lines'][number];

test.describe('Feature: voice order with AI matching', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Only isolated emulator fixtures are allowed');
    h = await createCloudHarness('voice-order-browser');
    await fakeRecorder(page);
    await mockAi(page, (call) => {
      if (call === 1)
        return {
          status: 'NEEDS_CLARIFICATION',
          lines: [
            line('line-0-8', 'NBS-MATOWA-100', 'Pomada Matowa', {
              aiMatch: {
                originalWording: 'Matowa',
                reason: 'Closest to the spoken name',
                alternatives: [
                  { productId: `${h.businessId}:NBS-DRYMATT-100`, productName: 'Pomada Dry Matt' },
                ],
              },
            }),
            {
              status: 'NEEDS_CLARIFICATION',
              lineId: 'line-9-17',
              originalWording: 'matte',
              reason: 'Choose a catalog product.',
              reasonCode: 'CHOOSE_PRODUCT',
              origin: 'assistant',
              quantity: 3,
              candidates: [
                {
                  productId: `${h.businessId}:NBS-MATTIFIER-100`,
                  productName: 'Mattifier',
                  suggested: true,
                  reason: 'Sounds like matte',
                },
                { productId: `${h.businessId}:NBS-DRYMATT-100`, productName: 'Pomada Dry Matt' },
              ],
            },
          ],
          excluded: [],
          toolEvents: [],
        };
      return {
        status: 'PROPOSAL',
        lines: [
          line('line-0-8', 'NBS-DRYMATT-100', 'Pomada Dry Matt'),
          line('line-9-17', 'NBS-MATTIFIER-100', 'Mattifier', { quantity: 3 }),
        ],
        excluded: [],
        toolEvents: [],
      };
    });
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });

  test('dictate, prepare, see AI labels and change the matched product', async ({ page }) => {
    await page.goto('/login');
    const c = h.loginCredentials('legnicka');
    await page.getByLabel('Email address').fill(c.email);
    await page.getByLabel('Password', { exact: true }).fill(c.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Legnicka', exact: true })).toBeVisible();
    if ((page.viewportSize()?.width ?? 1280) < 760)
      await page.getByRole('button', { name: 'Request products', exact: true }).click();
    await page.getByRole('tab', { name: 'Assistant', exact: true }).click();

    await page.getByRole('button', { name: 'Dictate order' }).click();
    await page.getByRole('button', { name: /Stop recording/ }).click();
    await expect(page.getByLabel('What do you need?')).toHaveValue(dictated);

    await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
    await expect(page.getByText(/Matched by AI/)).toBeVisible();
    await expect(page.getByText('Closest to the spoken name')).toBeVisible();
    await page.getByLabel('Product for matte').click({ force: true });
    await expect(page.getByRole('option', { name: /Mattifier\s*Suggested/ })).toBeVisible();
    await page.getByRole('option', { name: /Mattifier/ }).click();
    await page.getByRole('button', { name: 'Use selection', exact: true }).click();
    await expect(page.getByLabel('Units for Mattifier')).toHaveValue('3');

    await page.getByRole('button', { name: 'Change product for Pomada Matowa' }).click();
    await page.getByLabel('Product for Matowa').click({ force: true });
    await page.getByRole('option', { name: /Pomada Dry Matt/ }).click();
    await page.getByRole('button', { name: 'Use selection', exact: true }).click();
    await expect(page.getByLabel('Units for Pomada Dry Matt')).toHaveValue('2');
  });
});
