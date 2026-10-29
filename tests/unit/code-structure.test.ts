import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

const schemaRoot = 'dataconnect/schema';

function gqlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return gqlFiles(path);
    return entry.name.endsWith('.gql') ? [path] : [];
  });
}

describe('code structure', () => {
  it('schema: one type or enum per file, named after it', () => {
    const problems: string[] = [];
    for (const file of gqlFiles(schemaRoot)) {
      const rel = relative(schemaRoot, file);
      if (!rel.includes('/')) problems.push(`${rel}: must live in a domain folder`);
      const names = [...readFileSync(file, 'utf8').matchAll(/^(?:type|enum) (\w+)/gm)].map(
        (m) => m[1],
      );
      if (names.length !== 1) {
        problems.push(`${rel}: expected exactly one type or enum, found ${names.length}`);
      } else if (!rel.endsWith(`/${names[0]}.gql`)) {
        problems.push(`${rel}: file name must be ${names[0]}.gql`);
      }
    }
    expect(problems).toEqual([]);
  });
});
