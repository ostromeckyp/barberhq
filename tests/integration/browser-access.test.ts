import { afterEach, beforeEach, expect, it } from 'vitest';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { connectStorageEmulator, getBytes, getStorage, ref, uploadString } from 'firebase/storage';
import * as sdk from '@barberhq/browser';
import { createCloudHarness } from '../support/cloud.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness('browser-access');
});
afterEach(async () => {
  if (h) await h.dispose();
});
const fresh = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };

it('limits salon shorthand to that salon and HQ of its business', async () => {
  const list = (role: 'hq' | 'legnicka' | 'lodzka' | 'foreign' | 'unassigned') =>
    sdk.listSalonShorthand(h.browserClient(role), { salonId: h.legnickaId, after: '' }, fresh);
  await expect(list('legnicka')).resolves.toBeDefined();
  await expect(list('hq')).resolves.toBeDefined();
  for (const role of ['lodzka', 'foreign', 'unassigned'] as const)
    await expect(list(role)).rejects.toThrow();
});

it('limits HQ shorthand to HQ of the same business', async () => {
  const list = (role: 'hq' | 'legnicka' | 'foreign') =>
    sdk.listHqShorthand(h.browserClient(role), { businessId: h.businessId, after: '' }, fresh);
  await expect(list('hq')).resolves.toBeDefined();
  for (const role of ['legnicka', 'foreign'] as const) await expect(list(role)).rejects.toThrow();
});

it('limits active requests to the salon and HQ of its business', async () => {
  const list = (role: 'hq' | 'legnicka' | 'lodzka' | 'foreign' | 'unassigned') =>
    sdk.listActiveRequests(h.browserClient(role), { salonId: h.legnickaId }, fresh);
  await expect(list('legnicka')).resolves.toBeDefined();
  await expect(list('hq')).resolves.toBeDefined();
  for (const role of ['lodzka', 'unassigned'] as const) await expect(list(role)).rejects.toThrow();
  // A foreign HQ passes the role check but reads only its own business, so it sees nothing.
  expect((await list('foreign')).data.membership!.business.requests).toEqual([]);
});

it('lists only the products of the caller business', async () => {
  const own = (await sdk.listProducts(h.browserClient('legnicka'), {}, fresh)).data;
  expect(own.membership!.business.products_on_business.length).toBeGreaterThan(0);
  const foreign = (await sdk.listProducts(h.browserClient('foreign'), {}, fresh)).data;
  for (const product of foreign.membership?.business.products_on_business ?? [])
    expect(product.id.startsWith(`${h.businessId}:`)).toBe(false);
  await expect(sdk.listProducts(h.browserClient('unassigned'), {}, fresh)).rejects.toThrow();
});

it.runIf(process.env.BARBERHQ_TEST_MODE === 'emulator')(
  'denies every Storage read and write from a signed-in client',
  async () => {
    const storage = getStorage(h.browserClient('hq').app, 'gs://demo-barberhq.appspot.com');
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    const file = ref(storage, `knowledge/${h.businessId}/probe.pdf`);
    await expect(uploadString(file, 'probe')).rejects.toMatchObject({
      code: 'storage/unauthorized',
    });
    await expect(getBytes(file)).rejects.toMatchObject({ code: 'storage/unauthorized' });
  },
);
