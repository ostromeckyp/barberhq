import { afterEach, beforeEach, expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';

let h: Awaited<ReturnType<typeof createKnowledgeHarness>>;
beforeEach(async () => {
  h = await createKnowledgeHarness();
});
afterEach(async () => {
  if (h) await h.dispose();
});

it('compiled library reads enforce fresh role and business scope, publish filters, review pages and deterministic bounded paging', async () => {
  const identities = {
    hq: `library-hq-${crypto.randomUUID()}`,
    salon: `library-salon-${crypto.randomUUID()}`,
    foreign: `library-foreign-${crypto.randomUUID()}`,
  };
  const tokens = new Map<string, string>();
  const createdUids: string[] = [];
  type VersionRecord = {
    id: string;
    isActive?: boolean;
    createdAt?: string;
    pages?: { physicalPage: number }[];
  };
  type QueryPayload = {
    data?: { membership?: { business?: { versions: VersionRecord[] } } };
    errors?: unknown[];
    error?: unknown;
  };
  try {
    for (const [role, emailPrefix] of [
      ['hq', 'library-hq'],
      ['salon', 'library-salon'],
      ['foreign', 'library-foreign'],
    ] as const) {
      const signup = await fetch(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: `${emailPrefix}-${crypto.randomUUID()}@example.invalid`,
            password: 'test-password-123',
            returnSecureToken: true,
          }),
        },
      );
      const account = (await signup.json()) as { idToken: string; localId: string };
      expect(signup.ok).toBe(true);
      tokens.set(role, account.idToken);
      createdUids.push(account.localId);
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        {
          variables: {
            uid: account.localId,
            businessId: role === 'foreign' ? h.foreignId : h.id,
            role: role === 'hq' ? 'HQ' : 'SALON',
          },
        },
      );
    }

    async function query(
      operationName: string,
      variables: Record<string, unknown>,
      token?: string,
    ) {
      const response = await fetch(
        'http://127.0.0.1:9399/v1/projects/demo-barberhq/locations/europe-west1/services/barberhq/connectors/browser:executeQuery',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { 'X-Firebase-Auth-Token': token } : {}),
          },
          body: JSON.stringify({
            name: 'projects/demo-barberhq/locations/europe-west1/services/barberhq/connectors/browser',
            operationName,
            variables,
          }),
        },
      );
      return { response, payload: (await response.json()) as QueryPayload };
    }
    const versionsOf = (payload: QueryPayload): VersionRecord[] =>
      payload.data?.membership?.business?.versions ?? [];

    const emptySalon = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('salon'),
    );
    expect(emptySalon.payload.errors ?? []).toEqual([]);
    expect(versionsOf(emptySalon.payload)).toEqual([]);

    const stagedId = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
    const stagedHq = await query(
      'ListHqKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('hq'),
    );
    expect(versionsOf(stagedHq.payload).map((version) => version.id)).toContain(stagedId);
    const stagedSalon = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('salon'),
    );
    expect(versionsOf(stagedSalon.payload)).toEqual([]);

    const pipeline = h.pipeline(h.id);
    await pipeline.extractVersion(stagedId);
    let version = (await h.repo.version(stagedId))!;
    await pipeline.recordReview(
      {
        versionId: stagedId,
        pdfSha256: version.pdfSha256,
        extractionHash: version.extractionHash!,
        reviewedPhysicalPages: [1],
        approvalText: 'Reviewed test page',
        approvedAt: '2026-10-16',
      },
      { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
    );
    await pipeline.publishVersion({ versionId: stagedId, expectedDocumentRevision: 0 });

    const v2 = await pipeline.stageVersion({ ...h.entry, version: 'v2' }, h.bytes);
    await pipeline.extractVersion(v2);
    version = (await h.repo.version(v2))!;
    await pipeline.recordReview(
      {
        versionId: v2,
        pdfSha256: version.pdfSha256,
        extractionHash: version.extractionHash!,
        reviewedPhysicalPages: [1],
        approvalText: 'Reviewed replacement test page',
        approvedAt: '2026-10-16',
      },
      { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
    );
    await pipeline.publishVersion({ versionId: v2, expectedDocumentRevision: 1 });

    const salonRows = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('salon'),
    );
    const rows = versionsOf(salonRows.payload) as {
      id: string;
      isActive: boolean;
      createdAt: string;
    }[];
    expect(rows.map((item) => item.id)).toContain(stagedId);
    expect(rows.find((item) => item.id === stagedId)?.isActive).toBe(false);
    expect(rows.map((item) => `${item.createdAt}:${item.id}`)).toEqual(
      [...rows]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
        .map((item) => `${item.createdAt}:${item.id}`),
    );

    const pageOne = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('salon'),
    );
    const pageTwo = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 1, offset: 1 },
      tokens.get('salon'),
    );
    expect(versionsOf(pageOne.payload)[1]?.id).toBe(versionsOf(pageTwo.payload)[0]?.id);

    const review = await query('GetKnowledgeReview', { versionId: v2 }, tokens.get('hq'));
    expect(review.payload.errors ?? []).toEqual([]);
    expect(versionsOf(review.payload)[0]?.pages?.map((page) => page.physicalPage)).toEqual([1]);
    expect(JSON.stringify(review.payload)).not.toMatch(
      /objectPath|objectGeneration|embedding|bucket/i,
    );

    for (const [operation, variables] of [
      ['ListHqKnowledgeDocuments', { limit: 2, offset: 0 }],
      ['GetKnowledgeReview', { versionId: v2 }],
    ] as const) {
      const salonDenied = await query(operation, variables, tokens.get('salon'));
      expect(salonDenied.payload.errors?.length ?? 0).toBeGreaterThan(0);
      const foreignDenied = await query(operation, variables, tokens.get('foreign'));
      expect(foreignDenied.payload.errors?.length ?? 0).toBeGreaterThan(0);
      const anonymousDenied = await query(operation, variables);
      expect(anonymousDenied.payload.data?.membership).toBeUndefined();
    }

    await h.dc.executeGraphql(
      'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
      { variables: { id: stagedId } },
    );
    const afterRevocation = await query(
      'ListPublishedKnowledgeDocuments',
      { limit: 2, offset: 0 },
      tokens.get('salon'),
    );
    expect(versionsOf(afterRevocation.payload).map((item) => item.id)).not.toContain(stagedId);
  } finally {
    for (const uid of createdUids) {
      await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid },
      });
      await fetch(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=emulator-only',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken: [...tokens.values()][createdUids.indexOf(uid)] }),
        },
      );
    }
  }
});
