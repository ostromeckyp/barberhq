import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = 'web/src';
const quantityStyle = 'app/shared/styles/_quantity.scss';

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return styleFiles(path);
    return /\.(scss|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('web styles', () => {
  it('quantity numerals come only from the shared .qty class', () => {
    const repeated = styleFiles(webRoot)
      .map((file) => relative(webRoot, file))
      .filter((file) => file !== quantityStyle)
      .filter((file) => readFileSync(join(webRoot, file), 'utf8').includes('tabular-nums'));
    expect(repeated).toEqual([]);
  });
});
