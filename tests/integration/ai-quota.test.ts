import { localEmulatorHosts } from '../support/knowledge-target.ts';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDataConnect } from 'firebase-admin/data-connect';
import { describe, expect, it } from 'vitest';
import * as sql from '@barberhq/server';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';

function safeReason(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN';
  return error.message
    .split('\n')[0]
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    .slice(0, 160);
}

function localTarget() {
  const hosts = localEmulatorHosts();
  if (
    process.env.BARBERHQ_TEST_MODE !== 'emulator' ||
    process.env.BARBERHQ_TEST_CONFIG ||
    (process.env.DATA_CONNECT_EMULATOR_HOST &&
      process.env.DATA_CONNECT_EMULATOR_HOST !== hosts.dc) ||
    (process.env.FIREBASE_AUTH_EMULATOR_HOST &&
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== hosts.auth)
  )
    throw Error('AI quota test requires explicit demo-barberhq loopback emulator target');
  process.env.DATA_CONNECT_EMULATOR_HOST = hosts.dc;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
}

describe('real SQL AI quota', () => {
  it('shares ten UTC-hour admissions across endpoints and rejects the eleventh', async () => {
    localTarget();
    const suffix = randomUUID();
    const businessId = `test-ai-${suffix}`;
    const salonId = `test-ai-salon-${suffix}`;
    const salonUid = `test-ai-salon-user-${suffix}`;
    const hqUid = `test-ai-hq-user-${suffix}`;
    const app = initializeApp({ projectId: 'demo-barberhq' }, `ai-quota-${suffix}`);
    const dc = getDataConnect(sql.connectorConfig, app);
    const exec = (query: string, variables: Record<string, unknown>) =>
      dc.executeGraphql(query, { variables });
    let stage = 'setup-business';
    const cleanupFailures: string[] = [];
    let failure: Error | undefined;
    try {
      await exec('mutation($id:String!){business_insert(data:{id:$id,name:"AI fixture"})}', {
        id: businessId,
      });
      stage = 'setup-location';
      await exec(
        'mutation($id:String!,$businessId:String!){location_insert(data:{id:$id,businessId:$businessId,key:"ai-fixture",name:"AI salon",kind:SALON})}',
        { id: salonId, businessId },
      );
      stage = 'setup-memberships';
      await exec(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        { uid: salonUid, businessId, role: 'SALON' },
      );
      await exec(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        { uid: hqUid, businessId, role: 'HQ' },
      );
      stage = 'setup-salon-access';
      await exec(
        'mutation($uid:String!,$locationId:String!){salonAccess_insert(data:{membershipUid:$uid,locationId:$locationId})}',
        { uid: salonUid, locationId: salonId },
      );

      stage = 'read-actor-operation';
      const actorData = (await sql.readAiActor(dc, { uid: salonUid })).data.membership;
      expect(actorData?.role).toBe('SALON');
      stage = 'resolve-salon';
      const repo = createSqlAiRepository(dc);
      const admission = createAiAdmission(repo);
      const salon = await admission.resolveActor(salonUid);
      stage = 'concurrent-admission';
      const attempts = await Promise.allSettled(
        Array.from({ length: 11 }, (_, i) =>
          admission.admitAiCall(
            salon,
            i % 2 ? 'procedure' : 'replenishment',
            'valid input',
            new Date(0),
          ),
        ),
      );
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
      expect(
        attempts
          .filter((r) => r.status === 'rejected')
          .map((r) => (r as PromiseRejectedResult).reason.code),
      ).toEqual(['RATE_LIMITED']);
      const salonWindow = (await sql.readAiCurrentWindow(dc, { uid: salonUid })).data.window as {
        count?: unknown;
      } | null;
      expect(salonWindow?.count).toBe(10);

      stage = 'prior-hour';
      const priorHour = new Date(
        Math.floor((Date.now() - 3_600_000) / 3_600_000) * 3_600_000,
      ).toISOString();
      await exec(
        'mutation($uid:String!,$businessId:String!,$hour:Timestamp!){aiUsageWindow_insert(data:{uid:$uid,businessId:$businessId,hourStart:$hour,count:10})}',
        { uid: hqUid, businessId, hour: priorHour },
      );
      stage = 'resolve-hq';
      const hq = await admission.resolveActor(hqUid);
      stage = 'hq-admission';
      await admission.admitAiCall(hq, 'procedure', 'valid input', new Date('1970-01-01T00:00:00Z'));
      const hqWindow = (await sql.readAiCurrentWindow(dc, { uid: hqUid })).data.window as {
        count?: unknown;
      } | null;
      expect(hqWindow?.count).toBe(1);
      stage = 'unauthorized-role';
      await expect(repo.increment(salonUid, businessId, 'HQ')).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      const stillTen = (await sql.readAiCurrentWindow(dc, { uid: salonUid })).data.window as {
        count?: unknown;
      } | null;
      expect(stillTen?.count).toBe(10);
    } catch (error) {
      if (error instanceof Error && error.name === 'AssertionError') failure = error;
      else {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'SQL_SETUP_OR_EXECUTION';
        failure = Error(
          `AI emulator quota check failed at ${stage} (${/^[A-Z_]+$/.test(code) ? code : 'SQL_SETUP_OR_EXECUTION'}): ${safeReason(error)}; SDK details suppressed`,
        );
      }
    } finally {
      // Track all IDs from the outset: setup can commit before a response is lost.
      const cleanup = [
        () =>
          exec(
            'mutation($businessId:String!){aiUsageWindow_deleteMany(where:{businessId:{eq:$businessId}})}',
            { businessId },
          ),
        () =>
          exec('mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}', {
            uid: salonUid,
          }),
        () => exec('mutation($uid:String!){membership_delete(key:{uid:$uid})}', { uid: salonUid }),
        () => exec('mutation($uid:String!){membership_delete(key:{uid:$uid})}', { uid: hqUid }),
        () => exec('mutation($id:String!){location_delete(id:$id)}', { id: salonId }),
        () => exec('mutation($id:String!){business_delete(id:$id)}', { id: businessId }),
      ];
      for (const [index, task] of cleanup.entries())
        try {
          await task();
        } catch (error) {
          cleanupFailures.push(`${index}:${safeReason(error)}`);
        }
      await deleteApp(app).catch(() => {
        cleanupFailures.push('app:UNKNOWN');
      });
      if (cleanupFailures.length)
        failure = Error(
          `${failure?.message ?? 'AI emulator fixture cleanup failed'}; cleanup ${cleanupFailures.join(',')}; SDK details suppressed`,
        );
    }
    if (failure) throw failure;
  }, 30_000);
});
