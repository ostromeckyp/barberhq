/** Creates local-only demo accounts. No cloud project or credentials are used. */
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDataConnect } from 'firebase-admin/data-connect';
import { connectorConfig } from '@barberhq/server';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateSeed } from '../prepare-data/catalog.ts';
import { seedRecords, type MembershipSeed } from '../seed/business.ts';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.DATA_CONNECT_EMULATOR_HOST = '127.0.0.1:9399';
const app = initializeApp({ projectId: 'demo-barberhq' }, 'local-demo');
const path = 'config/demo-accounts.local.json';
try {
  const saved = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Record<
        string,
        { email: string; password: string }
      >)
    : {};
  const accounts: Record<string, { email: string; password: string }> = {};
  const memberships: MembershipSeed[] = [];
  const auth = getAuth(app);
  for (const role of ['hq', 'legnicka', 'lodzka', 'zakladowa']) {
    const uid = `local-${role}`,
      email = `${role}@barberhq.example.invalid`,
      password = saved[role]?.password ?? randomUUID() + randomUUID();
    try {
      await auth.getUser(uid);
      await auth.updateUser(uid, { email, password });
    } catch (e) {
      if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
      await auth.createUser({ uid, email, password });
    }
    accounts[role] = { email, password };
    memberships.push({
      uid,
      role: role === 'hq' ? 'HQ' : 'SALON',
      salonKeys: role === 'hq' ? [] : [role],
    });
  }
  const seed = validateSeed(JSON.parse(readFileSync('data/seed/business.json', 'utf8')));
  console.log(
    await seedRecords(
      getDataConnect(connectorConfig, app),
      seed,
      seed.businessKey,
      memberships,
      false,
    ),
  );
  writeFileSync(path, JSON.stringify(accounts, null, 2) + '\n', {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
  console.log(
    `Local accounts saved privately to ${path}. Existing inventory preserved. No cloud writes.`,
  );
} finally {
  await deleteApp(app);
}
