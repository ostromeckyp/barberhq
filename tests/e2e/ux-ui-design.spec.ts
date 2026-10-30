import { test, expect, type Page } from '@playwright/test';
import { createCloudHarness } from '../support/cloud.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let aiCalls: number;
const evidence = '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/ux-ui';
const phase = process.env.BARBERHQ_UX_PHASE === 'before' ? 'before' : 'after';

async function signIn(page: Page) {
  await page.goto('/login');
  const c = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
}

test.describe('Feature: design fidelity for request and procedure controls', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('UX checks require isolated local fixtures');
    h = await createCloudHarness('ux-ui');
    aiCalls = 0;
    await page.route(/\/(prepareReplenishment|answerProcedureQuestion)$/, async (route) => {
      if (route.request().method() !== 'OPTIONS') aiCalls++;
      await route.abort();
    });
    await signIn(page);
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });

  test.describe('Given a mobile request sheet with three manual products', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.getByRole('button', { name: 'Request Pomada Matowa', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Request products', exact: true });
      await sheet.getByLabel('Quantity', { exact: true }).fill('3');
      await sheet.getByRole('button', { name: 'Add to list', exact: true }).click();
      for (const name of ['Pomada Cement', 'Sól Morska']) {
        await sheet.getByRole('combobox', { name: 'Product', exact: true }).click();
        await page.getByRole('option', { name, exact: true }).click();
        await sheet.getByRole('button', { name: 'Add to list', exact: true }).click();
      }
      await expect(sheet.getByLabel('Units for Sól Morska')).toHaveValue('3');
    });
    test.describe('When the request content scrolls to the bottom', () => {
      let before: number;
      let after: number;
      let scrolled: number;
      let closeInViewport: boolean;
      let submitInViewport: boolean;
      test.beforeEach(async ({ page }) => {
        const handle = page.locator('.request-sheet-handle');
        before = (await handle.boundingBox())!.y;
        await page.screenshot({
          path: `${evidence}/sheet-${phase}-top.png`,
          animations: 'disabled',
        });
        scrolled = await page.locator('app-order-panel').evaluate((el) => {
          let parent = el.parentElement;
          while (
            parent &&
            (parent.scrollHeight <= parent.clientHeight + 1 ||
              !/auto|scroll/.test(getComputedStyle(parent).overflowY))
          )
            parent = parent.parentElement;
          if (!parent) return 0;
          parent.scrollTop = parent.scrollHeight;
          return parent.scrollTop;
        });
        await page.screenshot({
          path: `${evidence}/sheet-${phase}-scrolled.png`,
          animations: 'disabled',
        });
        after = (await handle.boundingBox())!.y;
        const close = page.getByRole('button', { name: 'Close request products', exact: true });
        const closeBox = (await close.boundingBox())!;
        closeInViewport = closeBox.y >= 0 && closeBox.y + closeBox.height <= 800;
        const submitBox = (await page
          .getByRole('button', { name: 'Submit request', exact: true })
          .boundingBox())!;
        submitInViewport = submitBox.y >= 0 && submitBox.y + submitBox.height <= 800;
        await close.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeHidden();
        await page.getByRole('button', { name: /^Request products/ }).click();
        await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
        await page.keyboard.press('Escape');
      });
      test('Then the handle and close control remain at the top while the draft survives', async ({
        page,
      }) => {
        expect(scrolled).toBeGreaterThan(100);
        expect(Math.abs(after - before)).toBeLessThan(1);
        expect(closeInViewport).toBe(true);
        expect(submitInViewport).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: /^Request products/ })).toBeFocused();
      });
    });
    test.describe('When the same draft is shown in the desktop panel', () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
      });
      test('Then remove buttons align with the product heading', async ({ page }) => {
        await expect(page.getByRole('dialog')).toBeHidden();
        const row = page
          .locator('.draft-line')
          .filter({ has: page.getByLabel('Units for Pomada Matowa') });
        const input = await row.locator('.line-name').boundingBox();
        const button = await row
          .getByRole('button', { name: 'Remove Pomada Matowa', exact: true })
          .boundingBox();
        await page.screenshot({
          path: `${evidence}/remove-${phase}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        expect(
          Math.abs(button!.y + button!.height / 2 - input!.y - input!.height / 2),
        ).toBeLessThan(2);
      });
    });
    test.describe('When quantity controls edit a card using the keyboard', () => {
      test.beforeEach(async ({ page }) => {
        const plus = page.getByRole('button', {
          name: 'Increase quantity for Pomada Matowa',
          exact: true,
        });
        await plus.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByLabel('Units for Pomada Matowa', { exact: true })).toHaveValue('4');
        await page.getByLabel('Units for Pomada Matowa', { exact: true }).fill('99');
      });
      test('Then the upper bound and projected stock are visible without changing inventory', async ({
        page,
      }) => {
        await expect(
          page.getByRole('button', { name: 'Increase quantity for Pomada Matowa', exact: true }),
        ).toBeDisabled();
        const card = page
          .locator('.draft-line')
          .filter({ has: page.getByLabel('Units for Pomada Matowa', { exact: true }) });
        await expect(card).toContainText('2 → 101');
        await expect(card).toContainText('HQ has 18 available');
        expect(await h.inventory()).toMatchObject({ hqOnHand: 18 });
        expect(aiCalls).toBe(0);
      });
    });
    test.describe('When a keyboard user selects a request example', () => {
      let firstExample: string;
      test.beforeEach(async ({ page }) => {
        const tab = page.getByRole('tab', { name: 'Assistant', exact: true });
        await tab.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Example', exact: true }).focus();
        await expect(page.getByRole('button', { name: 'Example', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByLabel('What do you need?')).toHaveValue('2 Pomada Cement');
        firstExample = await page.getByLabel('What do you need?').inputValue();
        await page.getByRole('button', { name: 'Several products', exact: true }).click();
        await page.screenshot({
          path: `${evidence}/examples-${phase}-320.png`,
          animations: 'disabled',
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(page.getByRole('dialog')).toBeHidden();
        await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
        await page.getByLabel('What do you need?').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${evidence}/examples-${phase}-1280.png`,
          fullPage: true,
          animations: 'disabled',
        });
      });
      test('Then examples fill the input without an AI call or changing manual quantities', async ({
        page,
      }) => {
        const input = page.getByLabel('What do you need?');
        expect(firstExample).toBe('2 Pomada Cement');
        await expect(input).toHaveValue('2 Pomada Cement, 3 Pomada Dry Matt, 1 Pomada Matowa');
        await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
        expect(aiCalls).toBe(0);
        expect(await h.inventory()).toMatchObject({ hqOnHand: 18 });
        await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
        await expect(
          page.getByRole('tab', { name: 'Assistant', exact: true }).locator('mat-icon'),
        ).toHaveText('auto_awesome');
        await expect(
          page.getByRole('tab', { name: 'Manual', exact: true }).locator('mat-icon'),
        ).toHaveText('list_alt');
      });
    });
  });
  test.describe('Given the procedure assistant', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('barberhq.language', 'pl'));
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto('/procedures');
    });
    test.describe('When a Polish question is entered', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('textbox', { name: 'Pytanie', exact: true })
          .fill('Co zrobić z uszkodzoną dostawą?');
      });
      test('Then the form accepts it without an English-only hint and tabs retain their names', async ({
        page,
      }) => {
        await expect(page.getByText('English questions only', { exact: true })).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Zapytaj asystenta', exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByRole('tab', { name: 'Asystent', exact: true }).locator('mat-icon'),
        ).toHaveText('auto_awesome');
        await expect(
          page.getByRole('tab', { name: 'Dokumenty', exact: true }).locator('mat-icon'),
        ).toHaveText('folder_open');
        await page.screenshot({
          path: `${evidence}/procedures-${phase}-320.png`,
          fullPage: true,
          animations: 'disabled',
        });
        expect(aiCalls).toBe(0);
      });
    });
    test.describe('When they choose the procedure example', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('button', {
            name: 'Otrzymaliśmy uszkodzony produkt. Co powinniśmy zrobić?',
            exact: true,
          })
          .click({ timeout: 3000 });
      });
      test('Then it fills a Polish question without starting an answer request', async ({
        page,
      }) => {
        await expect(page.getByRole('textbox', { name: 'Pytanie', exact: true })).toHaveValue(
          'Otrzymaliśmy uszkodzony produkt. Co powinniśmy zrobić?',
        );
        expect(aiCalls).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    });
  });
});
