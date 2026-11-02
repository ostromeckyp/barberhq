import { test, expect } from '@playwright/test';
import {
  createDeliveryHarness,
  seedDispatchedDelivery,
  type DeliveryHarness,
} from '../support/delivery.ts';
let h: DeliveryHarness;
test.beforeEach(async () => {
  h = await createDeliveryHarness('push-deep-link');
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
test('signed_out_notification_link_goes_through_login_to_the_request', async ({ page }) => {
  test.setTimeout(60000);
  const { requestId } = await seedDispatchedDelivery(h);
  const path = `/salons/${h.legnickaId}/requests/${requestId}`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  const c = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/requests/${requestId}$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
test('emulator_build_shows_no_notifications_section_and_no_worker', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/login');
  const c = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Legnicka', exact: true }).waitFor();
  await page.goto(`/salons/${h.legnickaId}/settings`);
  await expect(page.getByLabel('Low-stock threshold')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length)),
  ).toBe(0);
});
