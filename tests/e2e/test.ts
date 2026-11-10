import { test as base, type Browser } from '@playwright/test';

export * from '@playwright/test';

/**
 * Against preview or live, App Check needs a registered debug token: headless Chromium
 * can score too low for reCAPTCHA. Every new context gets it before the app starts,
 * including contexts and pages that specs create from `browser`.
 */
export const test = base.extend<object, { browser: Browser }>({
  browser: [
    async ({ browser }, use) => {
      const token = process.env['BARBERHQ_APPCHECK_DEBUG_TOKEN'];
      if (token) {
        const newContext = browser.newContext.bind(browser);
        browser.newContext = async (options) => {
          const context = await newContext(options);
          await context.addInitScript((value) => {
            (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
              value;
          }, token);
          return context;
        };
      }
      await use(browser);
    },
    { scope: 'worker' },
  ],
});
