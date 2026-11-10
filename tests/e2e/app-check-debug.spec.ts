import { test, expect, type Page } from './test.ts';

const token = process.env['BARBERHQ_APPCHECK_DEBUG_TOKEN'];
// Compares in the page and returns a boolean, so a failure never prints the token.
const hasToken = (page: Page) =>
  page.evaluate(
    (expected) =>
      (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN ===
      expected,
    token,
  );

test.describe('App Check debug token', () => {
  test.skip(!token, 'BARBERHQ_APPCHECK_DEBUG_TOKEN is not set');

  test('reaches pages from the page fixture, new contexts and new pages', async ({
    page,
    browser,
  }) => {
    await page.goto('about:blank');
    expect(await hasToken(page)).toBe(true);

    const context = await browser.newContext();
    const inContext = await context.newPage();
    await inContext.goto('about:blank');
    expect(await hasToken(inContext)).toBe(true);
    await context.close();

    const standalone = await browser.newPage();
    await standalone.goto('about:blank');
    expect(await hasToken(standalone)).toBe(true);
    await standalone.close();
  });
});
