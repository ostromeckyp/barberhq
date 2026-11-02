import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

type Group = {
  name: string;
  installMode?: string;
  updateMode?: string;
  resources?: { files?: string[]; urls?: string[] };
  urls?: string[];
  cacheConfig?: { strategy?: string };
};
const config = JSON.parse(readFileSync('web/ngsw-config.json', 'utf8')) as {
  assetGroups: Group[];
  dataGroups?: Group[];
  navigationUrls?: string[];
};
const group = (name: string) => config.assetGroups.find((entry) => entry.name === name);

it('prefetches the app shell and lazily caches static assets', () => {
  const app = group('app');
  expect(app?.installMode).toBe('prefetch');
  expect(app?.resources?.files).toEqual(
    expect.arrayContaining(['/index.html', '/manifest.webmanifest', '/*.css', '/*.js']),
  );
  const assets = group('assets');
  expect(assets?.installMode).toBe('lazy');
  expect(assets?.resources?.files).toEqual(expect.arrayContaining(['/icons/**', '/i18n/**']));
  expect(assets?.resources?.files).toContain('/pdf.worker.min.mjs');
});

it('caches only Google Fonts data and never API or auth traffic', () => {
  const dataGroups = config.dataGroups ?? [];
  const urls = dataGroups.flatMap((entry) => entry.urls ?? []);
  expect(urls.sort()).toEqual(['https://fonts.googleapis.com/**', 'https://fonts.gstatic.com/**']);
  for (const entry of dataGroups) expect(entry.cacheConfig?.strategy).toBe('performance');
  const everything = JSON.stringify(config.assetGroups.concat(dataGroups));
  for (const blocked of [
    'cloudfunctions.net',
    'run.app',
    'firebasedataconnect',
    'googleapis.com/identitytoolkit',
    'securetoken',
    'firebasestorage',
    'fcmregistrations',
  ])
    expect(everything).not.toContain(blocked);
});

it('keeps Firebase Auth handler paths out of navigation fallback', () => {
  expect(config.navigationUrls).toContain('/**');
  expect(config.navigationUrls).toContain('!/__/**');
});
