import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { createCloudHarness } from '../support/cloud.ts';
import { seedPdfViewerSource } from './pdf-viewer.fixture.ts';

let harness: Awaited<ReturnType<typeof createCloudHarness>>;
let fixture: Awaited<ReturnType<typeof seedPdfViewerSource>>;
let pdfFetchCount = 0;

async function signIn(page: Page, role: 'hq' | 'foreign' = 'hq') {
  await page.goto('/login');
  const credentials = harness.loginCredentials(role);
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salon requests' })).toBeVisible({
    timeout: 30000,
  });
}

async function checkAccessibility(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

async function highlightedInk(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="pdf-page-canvas"]');
    if (!canvas) return [];
    const marks = [...document.querySelectorAll<HTMLElement>('[data-testid="pdf-highlight"]')];
    const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    return marks.map((mark) => {
      const x0 = Math.floor(mark.offsetLeft * scale);
      const y0 = Math.floor(mark.offsetTop * scale);
      const x1 = Math.ceil((mark.offsetLeft + mark.offsetWidth) * scale);
      const y1 = Math.ceil((mark.offsetTop + mark.offsetHeight) * scale);
      let dark = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * image.width + x) * 4;
          if (image.data[i] < 180 && image.data[i + 1] < 180 && image.data[i + 2] < 180) dark++;
        }
      return { dark, x0, y0, x1, y1 };
    });
  });
}

test.describe('PDF source viewer', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000);
    harness = await createCloudHarness('pdf-viewer');
    fixture = await seedPdfViewerSource(harness);
    pdfFetchCount = 0;
    await page.route('**/getSourcePdf?*', async (route) => {
      pdfFetchCount++;
      if (new URL(route.request().url()).searchParams.get('versionId') !== fixture.versionId) {
        await route.fulfill({ status: 404 });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: fixture.bytes });
    });
  });
  test.afterEach(async () => {
    if (harness) await harness.dispose();
  });

  test.describe('Given an HQ user has a cited passage in a cropped rotated PDF', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test.describe('When HQ opens the source while acting for an authorized salon', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('combobox', { name: 'Workspace', exact: true }).click();
        await page.getByRole('option', { name: 'Salon — Legnicka', exact: true }).click();
        await expect(
          page.getByText('Acting on behalf of salon Legnicka', { exact: true }),
        ).toBeVisible();
        const sourceUrl = `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.verifiedChunkId)}`;
        await page.evaluate((url) => {
          window.history.pushState(null, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, sourceUrl);
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
      });
      test('Then the Procedures Back button preserves the authorized salon workspace', async ({
        page,
      }) => {
        const nav = page.getByRole('navigation', { name: 'Main navigation' });
        await expect(
          page.getByText('Acting on behalf of salon Legnicka', { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toContainText(
          'Salon — Legnicka',
        );
        await expect(nav.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Back to Procedures', exact: true }).click();
        await expect(page).toHaveURL(
          (url) => url.pathname === '/procedures' && url.searchParams.get('tab') === 'documents',
        );
        await expect(
          page.getByText('Acting on behalf of salon Legnicka', { exact: true }),
        ).toBeVisible();
        await expect(nav.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
      });
    });

    test.describe('When they open a link whose page disagrees with the cited chunk', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?page=1&chunk=${encodeURIComponent(fixture.verifiedChunkId)}`,
        );
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
      });

      test('Then the chunk page wins and both highlights sit over rendered text', async ({
        page,
      }) => {
        await expect(page.getByTestId('pdf-page-number')).toHaveText('2');
        await expect(page.getByRole('blockquote')).toContainText('Łódzka salon');
        const pixels = await highlightedInk(page);
        expect(pixels).toHaveLength(2);
        expect(pixels.every((mark) => mark.dark > 10 && mark.x0 >= 0 && mark.y0 >= 0)).toBe(true);
        await checkAccessibility(page);
        await page.screenshot({ path: 'artifacts/pdf-source-desktop.png', fullPage: true });
      });
    });

    test.describe('When they zoom and rotate the cited page', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.verifiedChunkId)}`,
        );
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.getByRole('button', { name: 'Rotate clockwise' }).click();
        await page.getByRole('button', { name: 'Rotate clockwise' }).click();
        await page.getByRole('button', { name: 'Rotate clockwise' }).click();
        await expect(page.getByText('150%', { exact: true })).toBeVisible();
      });
      test('Then the overlay follows the same viewport on desktop and mobile', async ({ page }) => {
        await expect
          .poll(() =>
            page
              .getByTestId('pdf-page-canvas')
              .evaluate((canvas: HTMLCanvasElement) => [canvas.style.width, canvas.style.height]),
          )
          .toEqual(['798px', '1147.5px']);
        await expect
          .poll(async () => {
            const pixels = await highlightedInk(page);
            return pixels.length === 2 && pixels.every((mark) => mark.dark > 10);
          })
          .toBe(true);
        await page.getByTestId('pdf-highlight').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/pdf-source-zoom-rotate.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await expect
          .poll(async () => {
            const pixels = await highlightedInk(page);
            return pixels.length === 2 && pixels.every((mark) => mark.dark > 10);
          })
          .toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await checkAccessibility(page);
        await page.getByTestId('pdf-highlight').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/pdf-source-mobile.png' });
      });
    });

    test.describe('When they open a page-only link beyond the PDF bounds', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/procedures/sources/${encodeURIComponent(fixture.versionId)}?page=99`);
        await expect(page.getByTestId('pdf-page-number')).toHaveText('1');
      });
      test('Then the page-only link shows the authorized PDF without inventing a highlight', async ({
        page,
      }) => {
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
      });
      test('Then keyboard users can read the authorized page transcript', async ({ page }) => {
        const transcript = page.getByTestId('pdf-page-transcript');
        await expect(transcript).toBeVisible();
        await expect(page.getByTestId('pdf-page-canvas')).toHaveAttribute(
          'aria-describedby',
          'pdf-page-transcript',
        );
        await transcript.locator('summary').focus();
        await page.keyboard.press('Enter');
        await expect(transcript).toContainText('Łódzka salon');
        await checkAccessibility(page);
      });
    });
    test.describe('When they advance from a page-only link', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/procedures/sources/${encodeURIComponent(fixture.versionId)}?page=1`);
        await expect(page.getByTestId('pdf-page-number')).toHaveText('1');
        await page.getByRole('button', { name: 'Next page' }).click();
      });
      test('Then the second page renders without a citation highlight', async ({ page }) => {
        await expect(page.getByTestId('pdf-page-number')).toHaveText('2');
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(0);
      });
      test('Then Next and Previous reuse the authorized PDF bytes after metadata checks', async ({
        page,
      }) => {
        await expect(page.getByTestId('pdf-page-canvas')).toBeVisible();
        await expect(page.getByTestId('pdf-page-transcript').locator('summary')).toHaveText(
          'Read page 2 text',
        );
        await page.getByRole('button', { name: 'Zoom in' }).click();
        await page.getByRole('button', { name: 'Rotate clockwise' }).click();
        await expect(page.getByText('125%', { exact: true })).toBeVisible();
        await expect(page.getByRole('status', { name: 'Rendering page…' })).toHaveCount(0);
        const viewport = await page
          .getByTestId('pdf-page-canvas')
          .evaluate((canvas: HTMLCanvasElement) => [canvas.style.width, canvas.style.height]);
        await page.getByRole('button', { name: 'Previous page' }).click();
        await expect(page.getByTestId('pdf-page-number')).toHaveText('1');
        await expect(page.getByTestId('pdf-page-canvas')).toBeVisible();
        await expect(page.getByTestId('pdf-page-transcript').locator('summary')).toHaveText(
          'Read page 1 text',
        );
        await expect(page.getByText('125%', { exact: true })).toBeVisible();
        await expect
          .poll(() =>
            page
              .getByTestId('pdf-page-canvas')
              .evaluate((canvas: HTMLCanvasElement) => [canvas.style.width, canvas.style.height]),
          )
          .toEqual(viewport);
        expect(pdfFetchCount).toBe(1);
      });
    });
    test.describe('When access is revoked after the first page is open', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/procedures/sources/${encodeURIComponent(fixture.versionId)}?page=1`);
        await expect(page.getByTestId('pdf-page-canvas')).toBeVisible();
        await harness.operator.executeGraphql(
          'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
          { variables: { id: fixture.versionId } },
        );
        await page.getByRole('button', { name: 'Next page' }).click();
      });
      test('Then revalidation removes the cached PDF and download', async ({ page }) => {
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0);
        expect(pdfFetchCount).toBe(1);
      });
    });
    test.describe('When a scanned page has no extracted text', () => {
      test.beforeEach(async ({ page }) => {
        await harness.operator.executeGraphql(
          'mutation($versionId:String!){knowledgePage_updateMany(where:{versionId:{eq:$versionId},physicalPage:{eq:1}},data:{text:""})}',
          { variables: { versionId: fixture.versionId } },
        );
        await page.goto(`/procedures/sources/${encodeURIComponent(fixture.versionId)}?page=1`);
      });
      test('Then the transcript states that extracted text is unavailable', async ({ page }) => {
        const transcript = page.getByTestId('pdf-page-transcript');
        await transcript.locator('summary').click();
        await expect(transcript).toContainText(
          'No extracted text is available for this scanned page.',
        );
      });
    });
    test.describe('When they follow a chunk without geometry', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.unavailableChunkId)}`,
        );
      });
      test('Then the excerpt remains visible with an explicit fallback', async ({ page }) => {
        await expect(page.getByText('Exact highlight unavailable', { exact: true })).toBeVisible();
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(0);
      });
    });

    test.describe('When they follow a chunk from another version', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=foreign-chunk`,
        );
      });
      test('Then no PDF evidence is displayed', async ({ page }) => {
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(0);
      });
    });

    test.describe('When they reload and sign out of the private source', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.verifiedChunkId)}`,
        );
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await page.reload();
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
        await page.getByRole('button', { name: 'Account menu' }).click();
        await page.getByRole('menuitem', { name: 'Sign out' }).click();
      });
      test('Then the private PDF and highlights leave the page', async ({ page }) => {
        await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(0);
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(0);
      });
    });
  });

  test.describe('Given a user from another business', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, 'foreign');
    });
    test.describe('When they open the private version URL', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.verifiedChunkId)}`,
        );
      });
      test('Then the source is denied without a PDF preview', async ({ page }) => {
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(0);
      });
    });
  });

  test.describe('Given HQ opens the canonical DAM-001 v1 procedure PDF', () => {
    test.beforeEach(async ({ page }) => {
      fixture = await seedPdfViewerSource(harness, 'canonical');
      await signIn(page);
    });
    test.describe('When they follow a cited intake passage', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(
          `/procedures/sources/${encodeURIComponent(fixture.versionId)}?chunk=${encodeURIComponent(fixture.verifiedChunkId)}`,
        );
        await expect(page.getByTestId('pdf-highlight')).toHaveCount(2);
      });
      test('Then the original procedure shows both lines and verified highlights', async ({
        page,
      }) => {
        await expect(
          page.getByRole('heading', { name: 'Damaged products in a salon delivery' }),
        ).toBeVisible();
        await expect(page.getByRole('blockquote')).toContainText('Do not mark an affected unit');
        await expect(page.getByTestId('pdf-page-number')).toHaveText('1');
        await expect
          .poll(async () => {
            const pixels = await highlightedInk(page);
            return pixels.length === 2 && pixels.every((mark) => mark.dark > 10);
          })
          .toBe(true);
        await page.getByTestId('pdf-highlight').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/pdf-source-canonical.png', fullPage: true });
      });
    });
  });
});
