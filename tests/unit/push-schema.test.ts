import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(path, 'utf8');

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe('push token schema', () => {
  it('declares PushToken keyed by token with a Membership reference', () => {
    const schema = read('dataconnect/schema/push/PushToken.gql');
    expect(schema).toMatch(/type PushToken\s+@table\(key: "token"\)/);
    expect(schema).toMatch(/membership: Membership!/);
  });

  it('keeps every push operation server-only', () => {
    const source = read('dataconnect/server/push/tokens.gql');
    const operations = source.match(/^(mutation|query) \w+/gm) ?? [];
    expect(operations.length).toBe(4);
    const noAccess = source.match(/@auth\(level: NO_ACCESS\)/g) ?? [];
    expect(noAccess.length).toBe(operations.length);
  });

  it('is not reachable from the browser connector', () => {
    for (const file of filesUnder('dataconnect/browser')) {
      expect(read(file)).not.toMatch(/push_token|PushToken/);
    }
  });

  it('resolves recipients through salon_access', () => {
    const source = read('dataconnect/server/push/tokens.gql');
    const body = source.slice(source.indexOf('query PushRecipients'));
    expect(body).toContain('salon_access');
  });
});
