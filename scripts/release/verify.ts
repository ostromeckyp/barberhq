import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { parsePublicConfig, type PublicConfig } from '../config/public-config.ts';
import { renderPublicConfig } from '../config/build-web.ts';

export type ReleaseRecord = {
  projectId: string;
  siteId: string;
  channelId: string;
  hostingVersionId: string;
  buildHash: string;
  configHash: string;
  baseUrl: string;
  backendRevision: string;
  verifiedAt: string;
};
export type ReleaseInput = Pick<ReleaseRecord, 'projectId' | 'siteId' | 'channelId' | 'baseUrl'> & {
  expectedBuildHash: string;
};
export type VerificationServices = {
  artifact: () => Promise<{ buildHash: string; configHash: string }>;
  channel: () => Promise<{ hostingVersionId: string; baseUrl: string }>;
  backendRevision: () => Promise<string>;
  checkHosted: () => Promise<void>;
  now: () => Date;
};
export function validatePromotion(before: ReleaseRecord, current: ReleaseRecord): void {
  for (const field of [
    'projectId',
    'siteId',
    'hostingVersionId',
    'buildHash',
    'configHash',
    'backendRevision',
  ] as const) {
    if (!before[field] || before[field] !== current[field])
      throw new Error(`Release drift: ${field}`);
  }
}

function origin(raw: string): string {
  const url = new URL(raw);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Release URL must be an explicit HTTPS origin');
  return url.origin;
}

export async function verifyRelease(
  input: ReleaseInput,
  services: VerificationServices,
): Promise<ReleaseRecord> {
  if (
    !/^[a-z][a-z0-9-]*$/.test(input.projectId) ||
    input.projectId.startsWith('demo-') ||
    !/^[a-z][a-z0-9-]*$/.test(input.siteId) ||
    !/^[a-zA-Z0-9_-]+$/.test(input.channelId)
  )
    throw new Error('Explicit production project, site and channel required');
  const baseUrl = origin(input.baseUrl);
  const artifact = await services.artifact();
  assert.match(artifact.buildHash, /^[a-f0-9]{64}$/, 'Invalid artifact hash');
  assert.match(artifact.configHash, /^[a-f0-9]{64}$/, 'Invalid configuration hash');
  assert.equal(artifact.buildHash, input.expectedBuildHash, 'Unexpected artifact hash');
  const before = await services.channel();
  assert.equal(origin(before.baseUrl), baseUrl, 'URL does not match the Hosting channel origin');
  assert.ok(
    before.hostingVersionId.startsWith(
      `projects/${input.projectId}/sites/${input.siteId}/versions/`,
    ),
    'Hosting version belongs to a different project/site',
  );
  const backendBefore = await services.backendRevision();
  assert.match(backendBefore, /^sha256:[a-f0-9]{64}$/, 'Verified backend fingerprint required');
  await services.checkHosted();
  const after = await services.channel();
  const backendAfter = await services.backendRevision();
  const artifactAfter = await services.artifact();
  assert.deepEqual(artifactAfter, artifact, 'Local artifact drift during verification');
  assert.equal(
    after.hostingVersionId,
    before.hostingVersionId,
    'Hosting version drift during verification',
  );
  assert.equal(origin(after.baseUrl), baseUrl, 'Hosting channel URL drift during verification');
  assert.equal(backendAfter, backendBefore, 'Backend drift during verification');
  return {
    projectId: input.projectId,
    siteId: input.siteId,
    channelId: input.channelId,
    hostingVersionId: before.hostingVersionId,
    buildHash: artifact.buildHash,
    configHash: artifact.configHash,
    baseUrl,
    backendRevision: backendBefore,
    verifiedAt: services.now().toISOString(),
  };
}

// Parse only the emitted runtime data literal; never execute bundled JavaScript.
function bundledLiteral(source: string, start: number): { value: unknown; end: number } {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let end = start;
  for (; end < source.length; end++) {
    const char = source[end];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
    } else if ('"\'`'.includes(char)) quote = char;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) break;
  }
  if (depth !== 0 || quote) throw new Error('Unterminated public configuration literal');
  const raw = source.slice(start, end + 1);
  const tokens =
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*|!0|!1|\s+|[{},:]|./gs;
  const json = raw.replace(tokens, (token: string, offset: number) => {
    if (token.startsWith('"')) return JSON.stringify(JSON.parse(token));
    if (token.startsWith('`') || token.startsWith("'")) {
      const text = token.slice(1, -1);
      if (text.includes('\\') || (token.startsWith('`') && text.includes('${')))
        throw new Error('Unsupported public configuration string literal');
      return JSON.stringify(text);
    }
    if (token === '!0') return 'true';
    if (token === '!1') return 'false';
    if (/^[A-Za-z_$]/.test(token)) {
      if (/^\s*:/.test(raw.slice(offset + token.length))) return JSON.stringify(token);
      if (token === 'true' || token === 'false') return token;
      throw new Error('Public configuration must contain literal data');
    }
    if (/^[{},:\s]+$/.test(token)) return token;
    throw new Error('Public configuration must contain literal data');
  });
  return { value: JSON.parse(json), end: end + 1 };
}

export function readBundledPublicConfig(directory: string): PublicConfig {
  const configs: PublicConfig[] = [];
  for (const file of readdirSync(directory).filter((name) => /^main(?:[-.].*)?\.js$/.test(name))) {
    const source = readFileSync(join(directory, file), 'utf8');
    for (const match of source.matchAll(/[{,]\s*(?:publicConfig|"publicConfig")\s*:\s*(?=\{)/g)) {
      const parsed = bundledLiteral(source, match.index! + match[0].length);
      if (
        !/^\s*,\s*(?:useEmulators|"useEmulators")\s*:\s*(?:!1|false)\s*}/.test(
          source.slice(parsed.end),
        )
      )
        throw new Error('Production release must disable emulator configuration');
      configs.push(parsePublicConfig(parsed.value));
    }
  }
  if (configs.length !== 1) throw new Error('Exactly one bundled public configuration is required');
  return configs[0];
}

export function assertPublicConfigMatches(expected: unknown, actual: unknown): void {
  if (!isDeepStrictEqual(parsePublicConfig(expected), parsePublicConfig(actual)))
    throw new Error(
      'Bundled public configuration differs from the explicitly approved configuration',
    );
}

export function assertBuildConfigurationHash(config: unknown, claimedHash: string): void {
  const value = parsePublicConfig(config);
  const source = renderPublicConfig(value, value.projectId, false, {
    connector: value.dataConnect.browserConnectorId,
    service: value.dataConnect.serviceId,
    location: value.dataConnect.location,
  });
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    claimedHash,
    'Build configuration hash differs from the verified runtime configuration',
  );
}
