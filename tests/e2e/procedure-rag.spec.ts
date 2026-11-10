import { test, expect, type Page } from './test.ts';
import { createCloudHarness } from '../support/cloud.ts';
import { seedProcedureCitation } from './procedure-rag.fixture.ts';

type Harness = Awaited<ReturnType<typeof createCloudHarness>>;
let harness: Harness;
let fixture: Awaited<ReturnType<typeof seedProcedureCitation>>;
let modelCalls = 0;

async function signIn(page: Page) {
  await page.goto('/login');
  const credentials = harness.loginCredentials('hq');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salon requests' })).toBeVisible({
    timeout: 30000,
  });
}

function callableHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers':
      'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
  };
}

test.describe('Procedure assistant cited source', () => {
  test.skip(
    process.env.BARBERHQ_RAG_E2E !== '1',
    'Requires the isolated emulator app with knowledgeEnabled and ragEnabled enabled only in its test config.',
  );
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000);
    harness = await createCloudHarness('procedure-rag');
    fixture = await seedProcedureCitation(harness);
    modelCalls = 0;
    await page.route('**/ai', async (route) => {
      const headers = callableHeaders(new URL(page.url()).origin);
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      if (
        route.request().method() !== 'POST' ||
        route.request().postDataJSON()?.data?.op !== 'answerProcedureQuestion'
      )
        return route.fallback();
      modelCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers,
        body: JSON.stringify({
          result: {
            status: 'ANSWER',
            steps: [
              {
                text: 'Do not mark an affected unit as good stock.',
                sourceSectionIds: [fixture.source.chunkId],
              },
            ],
            sources: [fixture.source],
            missingInformation: [],
          },
        }),
      });
    });
    await page.route('**/getSourcePdf?*', async (route) => {
      if (
        new URL(route.request().url()).searchParams.get('versionId') !== fixture.source.versionId
      ) {
        await route.fulfill({ status: 404 });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: fixture.bytes });
    });
    await signIn(page);
    await page.goto('/procedures');
    await expect(page.getByRole('heading', { name: 'Procedures', exact: true })).toBeVisible();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith('/ai') &&
        r.request().postDataJSON()?.data?.op === 'answerProcedureQuestion',
    );
    await page
      .getByRole('textbox', { name: 'Question' })
      .fill('What should the Zakładowa salon do under DEMO-DAMAGE-01?');
    await page.getByRole('button', { name: 'Ask assistant' }).click();
    await response;
  });
  test.afterEach(async () => {
    if (harness) await harness.dispose();
  });

  test.describe('Given an isolated cited answer is visible', () => {
    test.describe('When they inspect its supporting source', () => {
      test('Then the provenance, exact excerpt, version and physical page are visible', async ({
        page,
      }) => {
        await expect(
          page.getByText('Synthetic demo procedure', { exact: true }).first(),
        ).toBeVisible();
        await expect(page.getByText(fixture.source.excerpt, { exact: true })).toBeVisible();
        await expect(page.getByText('Version v1 · Page 1')).toBeVisible();
      });
    });
    test.describe('When they edit the next question and inspect its source using the keyboard', () => {
      let desktopColumns: boolean;
      let mobileStack: boolean;
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page
          .getByRole('textbox', { name: 'Question', exact: true })
          .fill('A different question for later');
        const header = page.getByRole('button', { name: /^Source 1:/ });
        await header.focus();
        await page.keyboard.press('Enter');
        await expect(header).toHaveAttribute('aria-expanded', 'false');
        await header.focus();
        await page.keyboard.press('Enter');
        await expect(header).toHaveAttribute('aria-expanded', 'true');
        const guidance = await page.locator('.guidance').boundingBox();
        const sources = await page
          .getByRole('complementary', { name: 'Supporting sources' })
          .boundingBox();
        desktopColumns = sources!.x > guidance!.x + guidance!.width;
        await page.screenshot({
          path: '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/design-fidelity/procedures-1280.png',
          fullPage: true,
          animations: 'disabled',
        });
        await page.setViewportSize({ width: 320, height: 900 });
        const narrowGuidance = await page.locator('.guidance').boundingBox();
        const narrowSources = await page
          .getByRole('complementary', { name: 'Supporting sources' })
          .boundingBox();
        mobileStack = narrowSources!.y >= narrowGuidance!.y + narrowGuidance!.height;
        await page.screenshot({
          path: '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/design-fidelity/procedures-320.png',
          fullPage: true,
          animations: 'disabled',
        });
      });
      test('Then the answered question stays truthful and sources adapt to the viewport', async ({
        page,
      }) => {
        await expect(page.locator('.asked-question')).toContainText(
          'What should the Zakładowa salon do under DEMO-DAMAGE-01?',
        );
        await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toHaveValue(
          'A different question for later',
        );
        await expect(page.getByRole('button', { name: /^Source 1:/ })).toBeFocused();
        await expect(page.getByText(fixture.source.excerpt, { exact: true })).toBeVisible();
        expect(desktopColumns).toBe(true);
        expect(mobileStack).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(modelCalls).toBe(1);
      });
    });
    test.describe('When they open the Documents tab', () => {
      let overflow: number[];
      test.beforeEach(async ({ page }) => {
        await page.getByRole('tab', { name: 'Documents', exact: true }).click();
        await expect(
          page.getByRole('heading', { name: fixture.source.title, exact: true }),
        ).toBeVisible();
        overflow = [];
        for (const width of [1280, 320]) {
          await page.setViewportSize({ width, height: 900 });
          overflow.push(
            await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          );
          await page.screenshot({
            path: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/design-fidelity/documents-${width}.png`,
            fullPage: true,
            animations: 'disabled',
          });
        }
      });
      test('Then the row exposes real version, page count and lifecycle actions at both widths', async ({
        page,
      }) => {
        const row = page.locator('app-document-row');
        await expect(row.locator('dl')).toContainText('Version');
        await expect(row.locator('dl')).toContainText('Pages');
        await expect(row.locator('dl')).toContainText(String(fixture.source.pageCount));
        await expect(row.locator('dl')).toContainText('Added');
        await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add document', exact: true })).toBeVisible();
        expect(overflow.every((value) => value <= 0)).toBe(true);
      });
    });
    test.describe('When they open the cited PDF', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('link', { name: /Open PDF/ })
          .first()
          .click();
      });
      test('Then the viewer opens the cited version with verified highlights', async ({ page }) => {
        await expect(page).toHaveURL(
          (url) =>
            decodeURIComponent(url.pathname) ===
              `/procedures/sources/${fixture.source.versionId}` &&
            url.searchParams.get('chunk') === fixture.source.chunkId &&
            url.searchParams.get('page') === String(fixture.source.physicalPage),
        );
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await expect(page.getByTestId('pdf-highlight').first()).toBeVisible();
        await expect(page.getByTestId('pdf-page-number')).toHaveText(
          String(fixture.source.physicalPage),
        );
      });
    });
    test.describe('When they return after reading the cited PDF', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('textbox', { name: 'Question', exact: true })
          .fill('Next question, not submitted yet');
        await page.getByRole('link', { name: /^Open paragraph / }).click();
        await expect(page.getByTestId('pdf-highlight').first()).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Back to Procedures', exact: true }),
        ).toBeVisible({
          timeout: 3000,
        });
        await page.getByRole('button', { name: 'Back to Procedures', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'What to do', exact: true })).toBeVisible();
        await page.screenshot({
          path: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/return-answer-${page.viewportSize()?.width}.png`,
          fullPage: true,
        });
      });
      test('Then the current question and answer remain available without another model call', async ({
        page,
      }) => {
        await expect(page.getByRole('textbox', { name: 'Question' })).toHaveValue(
          'Next question, not submitted yet',
        );
        await expect(page.getByRole('heading', { name: 'What to do', exact: true })).toBeVisible();
        await expect(
          page.getByText('Do not mark an affected unit as good stock.', { exact: true }),
        ).toBeVisible();
        await expect(page.locator('.asked-question')).toContainText(
          'What should the Zakładowa salon do under DEMO-DAMAGE-01?',
        );
        const citationUrl = new URL(
          (await page.getByRole('link', { name: /^Open paragraph / }).getAttribute('href'))!,
          page.url(),
        );
        expect(decodeURIComponent(citationUrl.pathname)).toBe(
          `/procedures/sources/${fixture.source.versionId}`,
        );
        expect(citationUrl.searchParams.get('chunk')).toBe(fixture.source.chunkId);
        expect(citationUrl.searchParams.get('page')).toBe('1');
        expect(citationUrl.searchParams.get('returnTo')).toBe('assistant');
        expect(modelCalls).toBe(1);
      });
    });
    test.describe('When they navigate the source controls and return using the keyboard', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('link', { name: /^Open paragraph / })
          .first()
          .focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('pdf-highlight').first()).toBeVisible();
        await page.getByRole('button', { name: 'Zoom in', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText('125%', { exact: true })).toBeVisible();
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);
        const back = page.getByRole('button', { name: 'Back to Procedures', exact: true });
        for (const width of [1280, 320]) {
          await page.setViewportSize({ width, height: 1000 });
          const metrics = await back.evaluate((button) => {
            const style = getComputedStyle(button);
            const icon = button.querySelector('mat-icon')!;
            return {
              height: button.getBoundingClientRect().height,
              leading: style.paddingLeft,
              trailing: style.paddingRight,
              iconWidth: icon.getBoundingClientRect().width,
              iconGap: getComputedStyle(icon).marginRight,
            };
          });
          expect(metrics).toEqual({
            height: width === 1280 ? 40 : 48,
            leading: '8px',
            trailing: '12px',
            iconWidth: 20,
            iconGap: '6px',
          });
        }
        await page.screenshot({
          path: '.superpowers/sdd/2026-09-29-barberhq-05-demo-release/back-buttons/pdf-back.png',
          fullPage: true,
          animations: 'disabled',
        });
        await page.getByRole('button', { name: 'Back to Procedures', exact: true }).focus();
        await page.keyboard.press('Enter');
      });
      test('Then the answer is preserved and the page still fits the viewport', async ({
        page,
      }) => {
        await expect(page.getByRole('heading', { name: 'What to do', exact: true })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Question', exact: true })).toHaveValue(
          'What should the Zakładowa salon do under DEMO-DAMAGE-01?',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect(modelCalls).toBe(1);
      });
    });
  });
});
