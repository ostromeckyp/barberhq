import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPublicConfig, selectSdkTarget } from '../../scripts/config/build-web.ts';
import { inspectArtifact } from '../../scripts/checks/hosting.ts';
import { checkHosting } from '../../scripts/checks/hosting.ts';
const config = {
  projectId: 'test-project',
  firebase: {
    projectId: 'test-project',
    apiKey: 'public-fixture-key',
    appId: '1:123:web:fixture',
    authDomain: 'test-project.firebaseapp.com',
  },
  functionsRegion: 'europe-west1',
  dataConnect: {
    serviceId: 'barberhq',
    location: 'europe-west1',
    browserConnectorId: 'browser',
  },
  hostingSiteId: 'test-project',
  appCheck: { siteKey: 'public-fixture-site-key' },
  replenishmentEnabled: false,
  knowledgeEnabled: false,
  replenishmentAiEnabled: false,
  ragEnabled: false,
};
it('renders only approved public fields for the explicitly selected project', () => {
  const output = renderPublicConfig(config, 'test-project');
  expect(output).toContain('public-fixture-key');
  expect(output).toContain('"useEmulators":false');
  expect(() => renderPublicConfig({ ...config, privateKey: 'secret' }, 'test-project')).toThrow();
  expect(() => renderPublicConfig(config, 'other-project')).toThrow();
  expect(() => renderPublicConfig(undefined, 'test-project')).toThrow();
});
it('selects the local SDK for emulators and requires a matching cloud SDK for releases', () => {
  const localPath = join(process.cwd(), 'web/src/app/core/generated/esm/index.esm.js');
  const dir = mkdtempSync(join(tmpdir(), 'barberhq-sdk-'));
  const cloudPath = join(dir, 'index.esm.js');
  try {
    expect(selectSdkTarget(true, localPath, cloudPath)).toEqual({
      connector: 'browser',
      service: 'barberhq',
      location: 'europe-west1',
    });
    expect(() => selectSdkTarget(false, localPath, cloudPath)).toThrow(
      'Cloud browser SDK is missing',
    );
    writeFileSync(
      cloudPath,
      "export const connectorConfig = { connector: 'browser', service: 'wrong', location: 'europe-west3' };\n",
    );
    expect(() =>
      renderPublicConfig(
        config,
        'test-project',
        false,
        selectSdkTarget(false, localPath, cloudPath),
      ),
    ).toThrow('differ');
    writeFileSync(
      cloudPath,
      "export const connectorConfig = { connector: 'browser', service: 'notbad-6be95-service', location: 'europe-west3' };\n",
    );
    const cloudConfig = {
      ...config,
      dataConnect: {
        serviceId: 'notbad-6be95-service',
        location: 'europe-west3',
        browserConnectorId: 'browser',
      },
    };
    expect(
      renderPublicConfig(
        cloudConfig,
        'test-project',
        false,
        selectSdkTarget(false, localPath, cloudPath),
      ),
    ).toContain('notbad-6be95-service');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it('rejects placeholder settings before a release', () => {
  expect(() =>
    renderPublicConfig(
      { ...config, appCheck: { siteKey: 'REPLACE_WITH_SITE_KEY' } },
      'test-project',
    ),
  ).toThrow();
});
it('refuses private artifacts and requires a browser index', () => {
  const dir = mkdtempSync(join(tmpdir(), 'barberhq-artifact-'));
  try {
    expect(() => inspectArtifact(dir)).toThrow();
    writeFileSync(join(dir, 'index.html'), '<html>app</html>');
    writeFileSync(join(dir, 'main-123.js'), 'console.log("public");');
    expect(inspectArtifact(dir).files).toEqual(['index.html', 'main-123.js']);
    writeFileSync(join(dir, 'company.pdf'), 'private');
    expect(() => inspectArtifact(dir)).toThrow();
    rmSync(join(dir, 'company.pdf'));
    writeFileSync(join(dir, 'main-123.js'), '-----BEGIN PRIVATE KEY-----');
    expect(() => inspectArtifact(dir)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('allows only the public PDF.js worker module and scans it for credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'barberhq-artifact-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<html>app</html>');
    writeFileSync(join(dir, 'pdf.worker.min.mjs'), 'export {}; // public worker');
    expect(inspectArtifact(dir).files).toEqual(['index.html', 'pdf.worker.min.mjs']);

    writeFileSync(join(dir, 'pdf.worker.min.mjs'), 'const credential = {"private_key": "secret"};');
    expect(() => inspectArtifact(dir)).toThrow();

    rmSync(join(dir, 'pdf.worker.min.mjs'));
    writeFileSync(join(dir, 'other.mjs'), 'export {}; ');
    expect(() => inspectArtifact(dir)).toThrow();

    rmSync(join(dir, 'other.mjs'));
    writeFileSync(join(dir, 'private.pdf'), 'private');
    expect(() => inspectArtifact(dir)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { verifyRelease } from '../../scripts/checks/release.ts';
it('blocks emulator artifacts, stale builds and a different deployment project', () => {
  const record = {
    mode: 'production',
    projectId: 'notbad-6be95',
    siteId: 'notbad-6be95',
    buildHash: 'hash',
  };
  expect(() => verifyRelease(record, 'hash', 'notbad-6be95', 'notbad-6be95')).not.toThrow();
  expect(() =>
    verifyRelease({ ...record, mode: 'emulator' }, 'hash', 'notbad-6be95', 'notbad-6be95'),
  ).toThrow();
  expect(() => verifyRelease(record, 'changed', 'notbad-6be95', 'notbad-6be95')).toThrow();
  expect(() => verifyRelease(record, 'hash', 'another-project', 'notbad-6be95')).toThrow();
});

function mockHostingFetch(options: { missingRoute?: string; workerMime?: string } = {}) {
  const html = '<html><script src="/main.js"></script><link href="/styles.css"></html>';
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(input.toString());
    if (options.missingRoute === url.pathname) return new Response('missing', { status: 404 });
    if (url.pathname === '/pdf.worker.min.mjs')
      return new Response('export {};', {
        headers: { 'content-type': options.workerMime ?? 'text/javascript' },
      });
    if (url.pathname.endsWith('.js'))
      return new Response('export {};', { headers: { 'content-type': 'text/javascript' } });
    if (url.pathname.endsWith('.css'))
      return new Response('body{}', { headers: { 'content-type': 'text/css' } });
    return new Response(html, {
      headers: { 'content-type': 'text/html', 'cache-control': 'no-cache' },
    });
  }) as typeof fetch;
}

it('checks opt-in document deep links and PDF worker JavaScript MIME', async () => {
  const originalFetch = globalThis.fetch;
  const seen: string[] = [];
  mockHostingFetch();
  const fetchMock = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input.toString());
    seen.push(url.pathname + url.search);
    return fetchMock(input, init);
  }) as typeof fetch;
  try {
    await expect(
      checkHosting('https://preview.example', {
        sourceVersionId: 'DOC-001:v1',
        reviewVersionId: 'DOC-001:v1',
      }),
    ).resolves.toMatchObject({ routes: 6, pdfWorker: true });
    expect(seen).toContain('/procedures?tab=documents');
    expect(seen).toContain('/procedures/sources/DOC-001%3Av1?page=1&chunk=known-chunk');
    expect(seen).toContain('/procedures/review/DOC-001%3Av1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('rejects a missing SPA route at the route status gate', async () => {
  const originalFetch = globalThis.fetch;
  mockHostingFetch({ missingRoute: '/login' });
  try {
    await expect(checkHosting('https://preview.example')).rejects.toThrow(
      'SPA route/header check failed: /login',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('rejects an incorrect PDF worker MIME at the worker MIME gate', async () => {
  const originalFetch = globalThis.fetch;
  mockHostingFetch({ workerMime: 'text/html' });
  try {
    await expect(checkHosting('https://preview.example')).rejects.toThrow(
      'PDF worker must be served as JavaScript',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('allows the public web app manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'barberhq-artifact-'));
  try {
    writeFileSync(join(dir, 'index.html'), '<html>app</html>');
    writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"BarberHQ"}');
    expect(inspectArtifact(dir).files).toEqual(['index.html', 'manifest.webmanifest']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
