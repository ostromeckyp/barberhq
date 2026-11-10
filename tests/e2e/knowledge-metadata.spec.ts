import { test, expect } from './test.ts';
import { resolve } from 'node:path';

// Controller-owned local UI domain adapter: SQL/extraction are real; Storage/vectors are fixtures.
// Browser execution for this increment is recorded through CUA in the implementation report.
const localUrl = process.env.BARBERHQ_METADATA_UI_URL;
test.skip(!localUrl, 'Requires the explicitly launched isolated metadata UI fixture.');
test('HQ independently selects product kind and provenance, then reviews the extracted PDF', async ({
  page,
}) => {
  if (!localUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(localUrl))
    throw Error('Local fixture URL required');
  await page.goto(`${localUrl}/login`);
  await page.getByRole('textbox', { name: 'Email address' }).fill('metadata-hq@example.invalid');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalMetadata123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Procedure docs' }).click();
  await page.getByRole('button', { name: 'Add document', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Document title' }).fill('Metadata fixture product card');
  await page.getByRole('combobox', { name: 'Document kind', exact: true }).click();
  await page.getByRole('option', { name: 'Product card', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Origin', exact: true })).toContainText(
    'Synthetic demo',
  );
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await (await chooser).setFiles(resolve('tests/fixtures/pdf/geometry.pdf'));
  await page.getByRole('button', { name: 'Register and upload' }).click();
  await expect(page.getByText('Synthetic demo product card', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Review and publish' }).last().click();
  await expect(page.getByText('Synthetic demo product card', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeVisible();
});
