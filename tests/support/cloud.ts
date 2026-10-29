import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  initializeApp as adminApp,
  deleteApp as deleteAdminApp,
  applicationDefault,
} from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getDataConnect as adminDc } from 'firebase-admin/data-connect';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import * as server from '@barberhq/server';
import * as browser from '@barberhq/browser';
import { seedRecords, type MembershipSeed } from '../../scripts/seed/business.ts';
import { validateSeed } from '../../scripts/prepare-data/catalog.ts';
import { parsePublicConfig } from '../../scripts/config/public-config.ts';
import { localEmulatorHosts } from './knowledge-target.ts';
const roles = ['hq', 'legnicka', 'lodzka', 'foreign', 'unassigned'] as const;
type Role = (typeof roles)[number];
export async function createCloudHarness(testName: string) {
  const local = process.env.BARBERHQ_TEST_MODE === 'emulator';
  const configPath = process.env.BARBERHQ_TEST_CONFIG;
  if (!local && !configPath)
    throw new Error(
      'BLOCKED: set BARBERHQ_TEST_MODE=emulator for local proof, or BARBERHQ_TEST_CONFIG to the verified private cloud-target file.',
    );
  const publicConfig = configPath
    ? parsePublicConfig(JSON.parse(readFileSync(configPath, 'utf8')))
    : null;
  const projectId = local ? 'demo-barberhq' : publicConfig!.projectId;
  if (
    !local &&
    (projectId !== 'notbad-6be95' || process.env.BARBERHQ_ALLOW_TEST_FIXTURES !== projectId)
  )
    throw new Error('Explicit demo-project fixture permission required');
  const hosts = localEmulatorHosts();
  const dcPort = Number(hosts.dc.split(':')[1]);
  if (local) {
    process.env.DATA_CONNECT_EMULATOR_HOST = hosts.dc;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
  } else if (process.env.DATA_CONNECT_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
    throw new Error('Cloud proof refuses emulator environment');
  const suffix = randomUUID();
  const businessId = `test-${testName}-${suffix}`;
  const foreignId = `foreign-${suffix}`;
  const operator = adminApp(
    { projectId, ...(!local ? { credential: applicationDefault() } : {}) },
    `operator-${suffix}`,
  );
  const auth = adminAuth(operator);
  const dc = adminDc(server.connectorConfig, operator);
  const users: Record<Role, string> = {} as Record<Role, string>;
  const clients = new Map<Role, ReturnType<typeof getDataConnect>>();
  const apps: ReturnType<typeof initializeApp>[] = [];
  const createdUids: string[] = [];
  const credentials = new Map<Role, { email: string; password: string }>();
  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  const memberships: MembershipSeed[] = [];
  async function dispose() {
    for (const id of [businessId, foreignId])
      await dc.executeGraphql('mutation DeleteFixture($id: String!) { business_delete(id:$id) }', {
        variables: { id },
      });
    for (const uid of createdUids) await auth.deleteUser(uid);
    await Promise.all(apps.map((a) => deleteApp(a)));
    await deleteAdminApp(operator);
  }
  try {
    for (const role of roles) {
      const email = `${role}-${suffix}@example.invalid`;
      const password = randomUUID() + randomUUID();
      credentials.set(role, { email, password });
      const record = await auth.createUser({ email, password });
      users[role] = record.uid;
      createdUids.push(record.uid);
      const app = initializeApp(
        local
          ? { projectId, apiKey: 'emulator-only', appId: 'emulator-only' }
          : publicConfig!.firebase,
        `${role}-${suffix}`,
      );
      apps.push(app);
      const a = getAuth(app);
      if (local)
        connectAuthEmulator(a, `http://${hosts.auth}`, {
          disableWarnings: true,
        });
      await signInWithEmailAndPassword(a, email, password);
      const data = getDataConnect(app, browser.connectorConfig);
      if (local) connectDataConnectEmulator(data, '127.0.0.1', dcPort);
      clients.set(role, data);
    }
    memberships.push(
      { uid: users.hq, role: 'HQ', salonKeys: [] },
      { uid: users.legnicka, role: 'SALON', salonKeys: ['legnicka'] },
      { uid: users.lodzka, role: 'SALON', salonKeys: ['lodzka'] },
    );
    await seedRecords(dc, seed, businessId, memberships, false);
    await seedRecords(
      dc,
      seed,
      foreignId,
      [{ uid: users.foreign, role: 'HQ', salonKeys: [] }],
      false,
    );
  } catch (e) {
    await dispose();
    throw e;
  }
  return {
    operator: dc,
    businessId,
    users,
    browserClient: (role: Role) => clients.get(role)!,
    loginCredentials: (role: Role) => credentials.get(role)!,
    legnickaId: `${businessId}:legnicka`,
    client: (role: Role) => ({
      getSalonInventory: async (salonId: string) => {
        const result = await browser.getSalonInventory(clients.get(role)!, {
          salonId,
        });
        return {
          inventory: result.data.membership?.business.salon[0]?.inventory,
        };
      },
    }),
    ordinaryOperatorWrite: async () => {
      const app = apps[roles.indexOf('legnicka')];
      const d = getDataConnect(app, {
        ...browser.connectorConfig,
        connector: 'server',
      });
      if (local) connectDataConnectEmulator(d, '127.0.0.1', dcPort);
      const { mutationRef, executeMutation } = await import('firebase/data-connect');
      return executeMutation(
        mutationRef(d, 'UpsertBusiness', {
          id: businessId,
          name: 'Unauthorized overwrite',
        }),
      );
    },
    setInventory: async (location: string, product: string, onHand: number) =>
      dc.executeGraphql(
        'mutation ChangeFixture($locationId:String!,$productId:String!,$onHand:Int!){inventory_update(key:{locationId:$locationId,productId:$productId},data:{onHand:$onHand})}',
        {
          variables: {
            locationId: `${businessId}:${location}`,
            productId: `${businessId}:${product}`,
            onHand,
          },
        },
      ),
    dryRun: () => seedRecords(dc, seed, businessId, memberships, true),
    seedAgain: () => seedRecords(dc, seed, businessId, memberships, false),
    inventory: async () => ({
      hqOnHand: (await server.readSeedState(dc, { businessId })).data.inventories.find(
        (r) =>
          r.locationId === `${businessId}:hq` && r.productId === `${businessId}:NBS-MATOWA-100`,
      )?.onHand,
    }),
    inventoryRowCount: async () =>
      (await server.readSeedState(dc, { businessId })).data.inventories.length,
    dispose,
  };
}
