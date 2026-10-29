import { test, expect } from '@playwright/test';

// Executable scenario for the controller-owned local adapter only. CUA is the
// recorded browser execution surface; this file is not evidence of a cloud run.
const reviewUrl = process.env.BARBERHQ_PRODUCT_REVIEW_URL;
test.describe('Product knowledge review', () => {
  test.skip(!reviewUrl, 'Requires an explicitly prepared unpublished local product review.');
  test.describe('Given HQ has an unpublished product review', () => {
    test.beforeEach(async ({ page }) => {
      if (!reviewUrl || !/^http:\/\/127\.0\.0\.1:\d+\/procedures\/review\//.test(reviewUrl))
        throw Error('Local product review URL required');
      await page.goto(new URL('/login', reviewUrl).href);
      await page
        .getByRole('textbox', { name: 'Email address', exact: true })
        .fill('hq.product-review@example.invalid');
      await page
        .getByRole('textbox', { name: 'Password', exact: true })
        .fill('LocalReview-Only-2026!');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Procedure docs', exact: true })).toBeVisible();
      await page.goto(reviewUrl);
    });
    test.describe('When HQ opens the review before deciding on proposals', () => {
      test('Then the original PDF remains available and publication requires explicit review', async ({
        page,
      }) => {
        await expect(
          page.getByRole('heading', { name: 'Product knowledge', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('img', { name: 'Rendered original PDF physical page', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('checkbox', {
            name: 'I checked this original page against its extracted text',
            exact: true,
          }),
        ).not.toBeChecked();
        await expect(
          page.getByRole('button', { name: 'Publish version', exact: true }),
        ).toBeDisabled();
        await expect(
          page.getByRole('button', { name: 'Save draft and refresh impact', exact: true }),
        ).toBeVisible();
      });
    });
  });
});
