import { describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  createSourceHandler,
  readSourceOriginal,
  resolveSourceIdentity,
} from '../../functions/src/knowledge/source.ts';
import { createKnowledgeHarness } from '../support/knowledge.ts';

describe('source PDF transport', () => {
  const bytes = Buffer.from('%PDF-1.7\nsource');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const version = {
    id: 'v1',
    businessId: 'business-1',
    status: 'READY',
    publishedAt: '2026-10-01',
    revokedAt: null,
    bucket: 'private',
    objectPath: 'original.pdf',
    objectGeneration: '42',
    pdfSha256: hash,
    byteSize: bytes.length,
    pageCount: 1,
    contentType: 'application/pdf',
  };
  function setup(overrides: Record<string, unknown> = {}) {
    const calls: string[] = [];
    const handler = createSourceHandler({
      origins: ['https://barber.example'],
      emulator: false,
      verifyAuth: async (token: string) => (token === 'valid' ? 'staff-1' : null),
      verifyAppCheck: async (token: string) => token === 'valid-app',
      resolve: async (uid: string, id: string) =>
        uid === 'staff-1' && id === 'v1' ? version : null,
      readOriginal: async (identity: typeof version) => {
        calls.push(`${identity.bucket}/${identity.objectPath}#${identity.objectGeneration}`);
        return bytes;
      },
      ...overrides,
    });
    const response = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      set(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      send(body: unknown) {
        this.body = body;
        return this;
      },
      end() {
        return this;
      },
    };
    return { handler, response, calls };
  }
  function request(overrides: Record<string, unknown> = {}) {
    return {
      method: 'GET',
      headers: {
        origin: 'https://barber.example',
        authorization: 'Bearer valid',
        'x-firebase-appcheck': 'valid-app',
      },
      query: { versionId: 'v1' },
      ...overrides,
    };
  }

  it('serves the pinned verified original privately', async () => {
    const { handler, response, calls } = setup();
    await handler(request(), response);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual(bytes);
    expect(calls).toEqual(['private/original.pdf#42']);
  });
  it.each([
    [
      'expired auth',
      {
        headers: {
          origin: 'https://barber.example',
          authorization: 'Bearer expired',
          'x-firebase-appcheck': 'valid-app',
        },
      },
      401,
    ],
    [
      'missing App Check',
      { headers: { origin: 'https://barber.example', authorization: 'Bearer valid' } },
      401,
    ],
    [
      'foreign origin',
      {
        headers: {
          origin: 'https://foreign.example',
          authorization: 'Bearer valid',
          'x-firebase-appcheck': 'valid-app',
        },
      },
      403,
    ],
    ['extra query', { query: { versionId: 'v1', businessId: 'business-1' } }, 400],
    ['unknown version', { query: { versionId: 'nope' } }, 404],
  ])('rejects %s', async (_name, changes, status) => {
    const { handler, response, calls } = setup();
    await handler(request(changes), response);
    expect(response.statusCode).toBe(status);
    expect(calls).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('original.pdf');
  });
  it.each([
    ['revoked', { revokedAt: '2026-10-02' }],
    ['oversize', { byteSize: 10 * 1024 * 1024 + 1 }],
    ['bad hash', { pdfSha256: '0'.repeat(64) }],
    ['wrong bytes', { byteSize: bytes.length + 1 }],
  ])('rejects %s metadata', async (_name, changes) => {
    const { handler, response } = setup({ resolve: async () => ({ ...version, ...changes }) });
    await handler(request(), response);
    expect(response.statusCode).not.toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('original.pdf');
  });
  it('allows only the exact configured origin on preflight', async () => {
    const { handler, response } = setup();
    await handler(request({ method: 'OPTIONS' }), response);
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://barber.example');
    const denied = setup();
    await denied.handler(
      request({ method: 'OPTIONS', headers: { origin: 'https://foreign.example' } }),
      denied.response,
    );
    expect(denied.response.statusCode).toBe(403);
    expect(denied.response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('does not return an original when the pinned generation is unavailable', async () => {
    const { handler, response } = setup({
      readOriginal: async () => {
        throw Error('generation missing');
      },
    });
    await handler(request(), response);
    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: 'SOURCE_UNAVAILABLE' });
  });
  it('rejects an unpublished registration with incomplete original identity before storage', async () => {
    const { handler, response, calls } = setup({
      resolve: async () => ({ ...version, publishedAt: null, pageCount: null }),
    });
    await handler(request(), response);
    expect(response.statusCode).toBe(409);
    expect(calls).toEqual([]);
  });
});

describe('source Storage runtime isolation', () => {
  const identity = {
    id: 'v1',
    businessId: 'demo',
    status: 'READY',
    publishedAt: '2026-10-01',
    revokedAt: null,
    bucket: 'demo-barberhq.appspot.com',
    objectPath: 'original.pdf',
    objectGeneration: '42',
    pdfSha256: '0'.repeat(64),
    byteSize: 8,
    pageCount: 1,
    contentType: 'application/pdf',
  };
  const local = {
    emulator: true,
    projectId: 'demo-barberhq',
    cloudBucket: 'notbad-6be95.firebasestorage.app',
    firebaseStorageHost: '127.0.0.1:9199',
    storageHost: undefined,
  };
  it.each([
    ['missing storage hosts', { ...local, firebaseStorageHost: undefined }],
    ['remote host', { ...local, firebaseStorageHost: 'storage.googleapis.com:9199' }],
    [
      'remote URL',
      {
        ...local,
        firebaseStorageHost: undefined,
        storageHost: 'http://storage.googleapis.com:9199',
      },
    ],
    [
      'HTTPS URL',
      { ...local, firebaseStorageHost: undefined, storageHost: 'https://127.0.0.1:9199' },
    ],
    ['mismatched hosts', { ...local, storageHost: 'http://localhost:9199' }],
    ['wrong project', { ...local, projectId: 'notbad-6be95' }],
    ['wrong bucket', { ...local }, { ...identity, bucket: 'notbad-6be95.firebasestorage.app' }],
    ['production with emulator host', { ...local, emulator: false, projectId: 'notbad-6be95' }],
  ])('rejects %s before opening Storage', async (_name, config, source = identity) => {
    let opened = false;
    await expect(
      readSourceOriginal(source, config, () => {
        opened = true;
        throw Error('opened');
      }),
    ).rejects.toThrow();
    expect(opened).toBe(false);
  });
  it.each([
    local,
    { ...local, firebaseStorageHost: undefined, storageHost: 'http://127.0.0.1:9199' },
    { ...local, storageHost: 'http://127.0.0.1:9199' },
  ])(
    'uses the pinned demo bucket and generation with valid local Storage emulator hosts',
    async (config) => {
      const bytes = Buffer.from('%PDF-1.7');
      let selected = '';
      const storage = () =>
        ({
          bucket: (bucket: string) => ({
            file: (path: string, options: { generation: number }) => ({
              createReadStream: () => {
                selected = `${bucket}/${path}#${options.generation}`;
                return (async function* () {
                  yield bytes;
                })();
              },
            }),
          }),
        }) as never;
      expect(await readSourceOriginal(identity, config, storage)).toEqual(bytes);
      expect(selected).toBe('demo-barberhq.appspot.com/original.pdf#42');
    },
  );
});

describe('source SQL membership scope', () => {
  it('allows HQ staged preview and denies foreign membership', async () => {
    const h = await createKnowledgeHarness();
    const hq = `hq-${randomUUID()}`,
      salon = `salon-${randomUUID()}`,
      foreign = `foreign-${randomUUID()}`;
    try {
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        { variables: { uid: hq, businessId: h.id, role: 'HQ' } },
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        { variables: { uid: salon, businessId: h.id, role: 'SALON' } },
      );
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!,$role:MemberRole!){membership_insert(data:{uid:$uid,businessId:$businessId,role:$role})}',
        { variables: { uid: foreign, businessId: h.foreignId, role: 'SALON' } },
      );
      const versionId = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
      expect((await resolveSourceIdentity(h.dc, hq, versionId))?.id).toBe(versionId);
      expect(await resolveSourceIdentity(h.dc, salon, versionId)).toBeNull();
      expect(await resolveSourceIdentity(h.dc, foreign, versionId)).toBeNull();
      expect(await resolveSourceIdentity(h.dc, hq, 'unknown')).toBeNull();
      const pipeline = h.pipeline(h.id);
      await pipeline.extractVersion(versionId);
      const state = (await h.repo.version(versionId))!;
      await pipeline.recordReview(
        {
          versionId,
          pdfSha256: state.pdfSha256,
          extractionHash: state.extractionHash!,
          reviewedPhysicalPages: [1],
          approvalText: 'Human approved',
          approvedAt: '2026-10-12',
        },
        { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
      );
      await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
      expect((await resolveSourceIdentity(h.dc, salon, versionId))?.id).toBe(versionId);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{isActive:false})}',
        { variables: { id: versionId } },
      );
      expect((await resolveSourceIdentity(h.dc, salon, versionId))?.id).toBe(versionId);
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
        { variables: { id: versionId } },
      );
      expect(await resolveSourceIdentity(h.dc, salon, versionId)).toBeNull();
    } finally {
      await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid: hq },
      });
      await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid: salon },
      });
      await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
        variables: { uid: foreign },
      });
      await h.dispose();
    }
  });
});

describe('browser source query authorization', () => {
  it('returns a page-only source and rejects a wrong chunk', async () => {
    const h = await createKnowledgeHarness();
    const email = `source-${randomUUID()}@example.invalid`;
    let idToken = '';
    let uid = '';
    try {
      const signup = await fetch(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password: 'test-password-123', returnSecureToken: true }),
        },
      );
      const user = (await signup.json()) as { idToken: string; localId: string };
      expect(signup.ok).toBe(true);
      idToken = user.idToken;
      uid = user.localId;
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_insert(data:{uid:$uid,businessId:$businessId,role:HQ})}',
        { variables: { uid, businessId: h.id } },
      );
      const versionId = await h.pipeline(h.id).stageVersion(h.entry, h.bytes);
      const query = async (chunkId?: string) => {
        const response = await fetch(
          'http://127.0.0.1:9399/v1/projects/demo-barberhq/locations/europe-west1/services/barberhq/connectors/browser:executeQuery',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'X-Firebase-Auth-Token': idToken },
            body: JSON.stringify({
              name: 'projects/demo-barberhq/locations/europe-west1/services/barberhq/connectors/browser',
              operationName: 'GetSourceSection',
              variables: { versionId, ...(chunkId ? { chunkId } : {}) },
            }),
          },
        );
        return {
          response,
          payload: (await response.json()) as {
            data?: {
              membership?: {
                business: {
                  versions: {
                    id: string;
                    chunks: unknown[];
                    pages: { physicalPage: number; text: string }[];
                  }[];
                };
              };
            };
            errors?: unknown[];
            error?: unknown;
          },
        };
      };
      const page = await query();
      expect(page.response.ok, JSON.stringify(page.payload)).toBe(true);
      expect(page.payload.data?.membership?.business.versions[0].id).toBe(versionId);
      expect(page.payload.data?.membership?.business.versions[0].chunks).toEqual([]);
      const pipeline = h.pipeline(h.id);
      await pipeline.extractVersion(versionId);
      const state = (await h.repo.version(versionId))!;
      await pipeline.recordReview(
        {
          versionId,
          pdfSha256: state.pdfSha256,
          extractionHash: state.extractionHash!,
          reviewedPhysicalPages: [1],
          approvalText: 'Human approved',
          approvedAt: '2026-10-12',
        },
        { kind: 'operator', id: 'test@example.invalid', businessId: h.id },
      );
      await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
      const chunk = (await h.repo.version(versionId))!.chunks[0];
      const correct = await query(chunk.id);
      expect(correct.payload.errors, JSON.stringify(correct.payload)).toEqual([]);
      expect(
        (
          correct.payload.data?.membership?.business.versions[0].chunks as {
            id: string;
            physicalPage: number;
          }[]
        )[0],
      ).toMatchObject({ id: chunk.id, physicalPage: chunk.physicalPage });
      expect(correct.payload.data?.membership?.business.versions[0].pages[0].text).toContain(
        'SYNTHETIC DEMO PROCEDURE',
      );
      const secondId = await pipeline.stageVersion({ ...h.entry, version: 'v2' }, h.bytes);
      await pipeline.extractVersion(secondId);
      const otherChunk = (await h.repo.version(secondId))!.chunks[0];
      const wrong = await query(otherChunk.id);
      expect(wrong.payload.errors).toBeDefined();
      expect(JSON.stringify(wrong.payload)).not.toContain(h.entry.inputPdf);
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_update(key:{uid:$uid},data:{businessId:$businessId})}',
        { variables: { uid, businessId: h.foreignId } },
      );
      const foreign = await query(chunk.id);
      expect(foreign.payload.errors).toBeDefined();
      await h.dc.executeGraphql(
        'mutation($uid:String!,$businessId:String!){membership_update(key:{uid:$uid},data:{businessId:$businessId})}',
        { variables: { uid, businessId: h.id } },
      );
      await h.dc.executeGraphql(
        'mutation($id:String!){knowledgeVersion_update(id:$id,data:{revokedAt_expr:"request.time"})}',
        { variables: { id: versionId } },
      );
      const revoked = await query(chunk.id);
      expect(revoked.payload.errors).toBeDefined();
    } finally {
      if (uid)
        await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
          variables: { uid },
        });
      if (idToken)
        await fetch(
          'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:delete?key=emulator-only',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idToken }),
          },
        );
      await h.dispose();
    }
  });
});
