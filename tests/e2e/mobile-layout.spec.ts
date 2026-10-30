import { test, expect, type Page } from '@playwright/test';
import { createDeliveryHarness, seedDispatchedDelivery } from '../support/delivery.ts';

type Harness = Awaited<ReturnType<typeof createDeliveryHarness>>;
let h: Harness;
let requestId: string;

async function signIn(page: Page, role: 'legnicka' | 'hq', landing: RegExp) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(landing);
  await page.evaluate(() => localStorage.setItem('barberhq.language', 'pl'));
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main, app-root').first()).toBeVisible();
  await expect(page.getByText(/Ładowanie|Loading/)).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function expectSameRow(boxes: ({ y: number } | null)[]) {
  const ys = boxes.map((box) => box!.y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
}

test.describe('Feature: mobile layout guard (390x844, Polish)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    h = await createDeliveryHarness('mobile-layout');
    requestId = (await seedDispatchedDelivery(h)).requestId;
    await page.setViewportSize({ width: 390, height: 844 });
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });

  test.describe('Given a salon user', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'legnicka', /\/salons\//);
    });

    test('Then salon home has no overflow and the last product clears the floating button', async ({
      page,
    }) => {
      await open(page, `/salons/${h.legnickaId}`);
      const button = page.getByRole('button', { name: 'Zamów produkty' }).first();
      await expect(button).toBeVisible();
      const cards = page.locator('[data-testid^="stock-"]');
      await expect(cards.first()).toBeVisible();
      await cards.last().evaluate((el) => {
        let parent = el.parentElement;
        while (
          parent &&
          (parent.scrollHeight <= parent.clientHeight + 1 ||
            !/auto|scroll/.test(getComputedStyle(parent).overflowY))
        )
          parent = parent.parentElement;
        if (parent) parent.scrollTop = parent.scrollHeight;
      });
      await page.waitForTimeout(300);
      const lastBox = (await cards.last().boundingBox())!;
      const buttonBox = (await button.boundingBox())!;
      expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(buttonBox.y + 0.5);
      await expectNoHorizontalOverflow(page);
    });

    test('Then request filters share one row and the page does not overflow', async ({ page }) => {
      await open(page, `/salons/${h.legnickaId}/requests`);
      const names = ['Wszystkie', 'Aktywne', 'Odebrane', 'Odrzucone'];
      const boxes = [];
      for (const name of names) {
        const toggle = page.getByRole('radio', { name }).or(page.getByRole('button', { name }));
        await expect(toggle.first()).toBeVisible();
        boxes.push(await toggle.first().boundingBox());
      }
      await expectSameRow(boxes);
      await expectNoHorizontalOverflow(page);
    });

    test('Then request detail does not overflow', async ({ page }) => {
      await open(page, `/salons/${h.legnickaId}/requests/${requestId}`);
      await expectNoHorizontalOverflow(page);
    });
  });

  test.describe('Given an HQ user', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'hq', /\/hq/);
    });

    test('Then the HQ home toggles share one row', async ({ page }) => {
      await open(page, '/hq');
      const orders = page.getByRole('radio', { name: 'Zamówienia' });
      const issues = page.getByRole('radio', { name: /^Problemy z dostawą \(\d+\)$/ });
      await expect(orders).toBeVisible();
      await expect(issues).toBeVisible();
      await expectSameRow([await orders.boundingBox(), await issues.boundingBox()]);
      await expectNoHorizontalOverflow(page);
    });

    test('Then HQ stock and edit product do not overflow', async ({ page }) => {
      await open(page, '/hq/stock');
      await expectNoHorizontalOverflow(page);
      await open(
        page,
        `/hq/stock/products/${encodeURIComponent(`${h.businessId}:NBS-MATOWA-100`)}`,
      );
      await expect(page.getByRole('heading', { name: /Edytuj produkt/ })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });
});
