import { test, expect, type Page } from '@playwright/test';
import { createCloudHarness } from '../support/cloud.ts';
import type { ClientLogEvent } from '../../shared/contracts/logging/index.ts';
import type { ProposalResult } from '../../shared/contracts/ai/index.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
const MESSAGE = '2 Matowa for the morning shift';

async function login(page: Page) {
  await page.goto('/login');
  const c = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Legnicka', exact: true })).toBeVisible();
}

async function proposeOneLine(page: Page) {
  const result: ProposalResult = {
    status: 'PROPOSAL',
    lines: [
      {
        status: 'READY',
        lineId: 'line-0-8',
        productId: `${h.businessId}:NBS-MATOWA-100`,
        productName: 'Pomada Matowa',
        quantity: 2,
        origin: 'assistant',
        hqAvailable: 18,
        salonOnHand: 2,
        hqInventoryVersion: 1,
        salonInventoryVersion: 1,
      },
    ],
    excluded: [],
    toolEvents: [],
  };
  await page.route('**/ai', async (route) => {
    const headers = {
      'access-control-allow-origin': new URL(page.url()).origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().postDataJSON()?.data?.op !== 'prepareReplenishment')
      return route.fallback();
    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({ result }),
    });
  });
}

async function orderAndSubmit(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 760)
    await page.getByRole('button', { name: 'Request products', exact: true }).click();
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
  await page.getByLabel('What do you need?').fill(MESSAGE);
  await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
  await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('2');
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(page.getByText('Request submitted.', { exact: true })).toBeVisible({
    timeout: 20000,
  });
}

async function hide(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.describe('Feature: production logging', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Only isolated emulator fixtures are allowed');
    h = await createCloudHarness('client-log-browser');
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });

  test('the request path sends its steps in order and never the typed text', async ({ page }) => {
    const bodies: string[] = [];
    await page.route('**/clientLog', async (route) => {
      const headers = {
        'access-control-allow-origin': new URL(page.url()).origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      };
      if (route.request().method() === 'POST') bodies.push(route.request().postData() ?? '');
      await route.fulfill({ status: 204, headers });
    });
    await proposeOneLine(page);
    await login(page);
    await orderAndSubmit(page);
    const names = () =>
      bodies.flatMap((b) => (JSON.parse(b).events as ClientLogEvent[]).map((e) => e.event));
    const expected = [
      'session.ready',
      'call.prepareReplenishment',
      'request.prepare.result',
      'request.submit.queued',
      'call.submitRequest',
      'request.submit.outcome',
    ];
    await expect
      .poll(
        async () => {
          await hide(page);
          return expected.every((name) => names().includes(name));
        },
        { timeout: 20000 },
      )
      .toBe(true);
    const order = expected.map((name) => names().indexOf(name));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const events = bodies.flatMap((b) => JSON.parse(b).events as ClientLogEvent[]);
    for (const event of events) {
      expect(event.sessionId).toBeTruthy();
      expect(event.build).toBe('local');
      expect(event.channel).toBe('local');
    }
    expect(bodies.join('\n')).not.toContain(MESSAGE);
    expect(bodies.join('\n')).not.toContain(h.loginCredentials('legnicka').email);
  });

  test('the clientLog emulator accepts the batch', async ({ page }) => {
    await proposeOneLine(page);
    await login(page);
    const accepted = page.waitForResponse(
      (r) => r.url().includes('/clientLog') && r.request().method() === 'POST',
      { timeout: 30000 },
    );
    await hide(page);
    expect((await accepted).status()).toBe(204);
  });
});
