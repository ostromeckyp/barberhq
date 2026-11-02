import { TestBed } from '@angular/core/testing';
import { getToken } from 'firebase/app-check';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PublicConfig } from '../../../../scripts/config/public-config';
import { KnowledgeDocumentsApi } from '../features/procedures/data-access/knowledge-documents-api';
import { FIREBASE } from './firebase.providers';
import { KnowledgeApi } from './knowledge-api';
import { runtimeConfig } from './public-config';

vi.mock('firebase/auth', () => ({ getIdToken: vi.fn().mockResolvedValue('id-token') }));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'ac-token' }),
}));

beforeEach(() => {
  runtimeConfig.publicConfig = {
    projectId: 'p',
    functionsRegion: 'r',
    pdfReadUrl: 'https://example.invalid/pdf',
  } as unknown as PublicConfig;
  runtimeConfig.useEmulators = false;
});
afterEach(() => {
  runtimeConfig.publicConfig = null;
  vi.unstubAllGlobals();
});

it('waits for App Check before fetching the PDF and sends its token', async () => {
  let release: (value: object) => void = () => undefined;
  const appCheck = vi.fn(() => new Promise<object>((resolve) => (release = resolve)));
  TestBed.configureTestingModule({
    providers: [
      KnowledgeApi,
      { provide: KnowledgeDocumentsApi, useValue: {} },
      { provide: FIREBASE, useValue: { auth: { currentUser: {} }, appCheck } },
    ],
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(new TextEncoder().encode('%PDF-1.7'), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const pending = TestBed.inject(KnowledgeApi).getPdf('v1');
  await new Promise((resolve) => setTimeout(resolve));
  expect(fetchMock).not.toHaveBeenCalled();

  release({ name: 'appcheck' });
  await pending;
  expect(getToken).toHaveBeenCalledWith({ name: 'appcheck' });
  const headers = new Headers(fetchMock.mock.calls[0][1].headers);
  expect(headers.get('x-firebase-appcheck')).toBe('ac-token');
});
