import { test, expect, type Locator, type Page } from '@playwright/test';
import { createDeliveryHarness, seedDispatchedDelivery } from '../support/delivery.ts';

type Harness = Awaited<ReturnType<typeof createDeliveryHarness>>;
let h: Harness;

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
  await setLanguage(page, 'pl');
}

async function setLanguage(page: Page, language: 'pl' | 'en') {
  await page.evaluate((value) => localStorage.setItem('barberhq.language', value), language);
}

/** Opens a page and waits for its real content, not just the shell. */
async function open(page: Page, path: string, content: Locator) {
  await page.goto(path);
  await expect(content).toBeVisible({ timeout: 15000 });
}

/** The shell scrolls inside mat-sidenav-content, so check it as well as the document. */
async function expectNoHorizontalOverflow(page: Page) {
  const boxes = await page.evaluate(() =>
    [document.documentElement, document.querySelector('mat-sidenav-content')].map((el) =>
      el ? { name: el.tagName, scroll: el.scrollWidth, client: el.clientWidth } : null,
    ),
  );
  expect(boxes[1], 'mat-sidenav-content is the scroll container').not.toBeNull();
  for (const box of boxes)
    expect(box!.scroll, `${box!.name} scrollWidth`).toBeLessThanOrEqual(box!.client);
}

/** Each toggle sits on one row and is fully inside the group's visible box (nothing clipped). */
async function expectTogglesFullyVisible(group: Locator, toggles: Locator[]) {
  expect(await group.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  const groupBox = (await group.boundingBox())!;
  const boxes = [];
  for (const toggle of toggles) {
    await expect(toggle).toBeVisible();
    boxes.push((await toggle.boundingBox())!);
  }
  const ys = boxes.map((box) => box.y);
  expect(Math.max(...ys) - Math.min(...ys), 'toggles share one row').toBeLessThanOrEqual(1);
  for (const [i, box] of boxes.entries()) {
    expect(box.x, `toggle ${i} left edge`).toBeGreaterThanOrEqual(groupBox.x - 0.5);
    expect(box.x + box.width, `toggle ${i} right edge`).toBeLessThanOrEqual(
      groupBox.x + groupBox.width + 0.5,
    );
  }
}

/** Words in the visible column headers that are split across lines, or headers that overflow. */
async function brokenHeaderWords(page: Page) {
  return page.locator('.stock-table thead th').evaluateAll((cells) =>
    cells
      .filter((cell) => getComputedStyle(cell).display !== 'none')
      .flatMap((cell) => {
        const broken: string[] = [];
        if (cell.scrollWidth > cell.clientWidth + 1) broken.push(`overflow: ${cell.textContent}`);
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          for (const word of node.textContent!.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, word.index);
            range.setEnd(node, word.index + word[0].length);
            const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
            if (lines.size > 1) broken.push(word[0]);
          }
        }
        return broken;
      }),
  );
}

test.describe('Feature: mobile layout guard (390x844, Polish)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    h = await createDeliveryHarness('mobile-layout');
    await page.setViewportSize({ width: 390, height: 844 });
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });

  test.describe('Given a salon user', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'legnicka', /\/salons\//);
    });

    test('Then salon home has no overflow and the floating button covers no product or link', async ({
      page,
    }) => {
      const cards = page.locator('.compact-record');
      await open(page, `/salons/${h.legnickaId}`, cards.first());
      const fab = page.getByRole('button', { name: 'Zamów produkty' });
      await expect(fab).toBeVisible();
      await page
        .locator('mat-sidenav-content')
        .evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(300);
      const fabTop = (await fab.boundingBox())!.y;
      const lastCard = (await cards.last().boundingBox())!;
      const lastRequest = (await cards
        .last()
        .getByRole('button', { name: /^Zamów:/ })
        .boundingBox())!;
      expect(lastRequest.y + lastRequest.height, 'last Zamów button').toBeLessThanOrEqual(fabTop);
      expect(lastCard.y + lastCard.height, 'last product card').toBeLessThanOrEqual(fabTop);
      const link = (await page.getByRole('link', { name: 'Zobacz zamówienia' }).boundingBox())!;
      expect(link.y + link.height, 'requests link').toBeLessThanOrEqual(fabTop);
      await expectNoHorizontalOverflow(page);
    });

    test('Then all request filters are fully visible on one row and the page does not overflow', async ({
      page,
    }) => {
      const list = page.locator('app-request-list .compact-record, app-request-list .empty');
      await open(page, `/salons/${h.legnickaId}/requests`, list.first());
      const group = page.getByRole('radiogroup', { name: 'Status zamówienia' });
      const names = ['Wszystkie', 'Aktywne', 'Odebrane', 'Odrzucone'];
      await expectTogglesFullyVisible(
        group,
        names.map((name) => page.getByRole('radio', { name })),
      );
      await expectNoHorizontalOverflow(page);
    });

    test('Then request detail does not overflow and Stock now headers wrap only between words', async ({
      page,
    }) => {
      const { requestId } = await seedDispatchedDelivery(h);
      const path = `/salons/${h.legnickaId}/requests/${requestId}`;
      await open(page, path, page.getByTestId('hq-on-hand').first());
      await expectNoHorizontalOverflow(page);
      expect(await brokenHeaderWords(page)).toEqual([]);

      await page.setViewportSize({ width: 1280, height: 900 });
      expect(await brokenHeaderWords(page), 'Polish, 1280 px').toEqual([]);
      await setLanguage(page, 'en');
      await open(page, path, page.getByRole('columnheader', { name: 'Available' }));
      expect(await brokenHeaderWords(page), 'English, 1280 px').toEqual([]);
    });
  });

  test.describe('Given an HQ user', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'hq', /\/hq/);
    });

    test('Then the HQ home toggles are fully visible on one row', async ({ page }) => {
      const orders = page.getByRole('radio', { name: 'Zamówienia' });
      await open(page, '/hq', page.getByRole('heading', { name: /^Oczekujące/ }));
      const issues = page.getByRole('radio', { name: /^Problemy z dostawą \(\d+\)$/ });
      await expectTogglesFullyVisible(page.getByRole('radiogroup', { name: 'Widok kolejki' }), [
        orders,
        issues,
      ]);
      await expectNoHorizontalOverflow(page);
    });

    test('Then HQ stock and edit product do not overflow', async ({ page }) => {
      await open(page, '/hq/stock', page.locator('[data-testid^="hq-stock-"]').first());
      await expectNoHorizontalOverflow(page);
      await open(
        page,
        `/hq/stock/products/${encodeURIComponent(`${h.businessId}:NBS-MATOWA-100`)}`,
        page.getByRole('heading', { name: /Edytuj produkt/ }),
      );
      await expect(page.getByLabel('Nazwa', { exact: true })).not.toHaveValue('');
      await expectNoHorizontalOverflow(page);
    });
  });
});
