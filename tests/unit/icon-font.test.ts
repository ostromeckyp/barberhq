import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = 'web/src/app';
const indexHtml = readFileSync('web/src/index.html', 'utf8');
const iconName = /^[a-z0-9_]+$/;

// Quoted literals, except the ones compared against (`kind === 'hq'`) rather than rendered.
function* renderedLiterals(text: string): Generator<string> {
  for (const match of text.matchAll(/(['"])([^'"]*)\1/g)) {
    if (!/[!=]==\s*$/.test(text.slice(0, match.index))) yield match[2];
  }
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('generated') ? [] : sourceFiles(path);
    const isSource = /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts');
    return isSource ? [path] : [];
  });
}

function googleFontLinks(): string[] {
  return [...indexHtml.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)].map(
    (match) => match[1].replaceAll('&amp;', '&'),
  );
}

function iconNames(): string[] {
  const link = googleFontLinks().find((href) =>
    new URL(href).searchParams.get('family')?.startsWith('Material Symbols Outlined'),
  );
  const value = link ? new URL(link).searchParams.get('icon_names') : null;
  return value ? value.split(',') : [];
}

function usedIcons(): string[] {
  const used = new Set<string>();
  const add = (candidate: string): void => {
    if (iconName.test(candidate)) used.add(candidate);
  };
  for (const file of sourceFiles(appRoot)) {
    const text = readFileSync(file, 'utf8');
    for (const [, body] of text.matchAll(/<mat-icon\b[^>]*>([\s\S]*?)<\/mat-icon/g)) {
      for (const literal of renderedLiterals(body)) add(literal);
      const bare = body.replace(/\{\{[\s\S]*?\}\}/g, ' ');
      for (const word of bare.split(/\s+/)) add(word);
    }
    for (const [, name] of text.matchAll(/\bfontIcon="([^"]+)"/g)) add(name);
    for (const [, name] of text.matchAll(/(?<![\w\[-])icon="([^"]+)"/g)) add(name);
    for (const [, name] of text.matchAll(/\bicon[A-Za-z]*\s*:\s*'([^']+)'/g)) add(name);
    for (const [, binding] of text.matchAll(/\[icon\]="([^"]*)"/g)) {
      for (const literal of renderedLiterals(binding)) add(literal);
    }
  }
  return [...used].sort();
}

describe('icon font subset', () => {
  it('requests Material Symbols with an icon_names subset', () => {
    expect(iconNames().length).toBeGreaterThan(0);
  });

  it('lists icon_names sorted and unique', () => {
    const names = iconNames();
    expect(names).toEqual([...new Set(names)].sort());
  });

  it('includes every icon the app uses', () => {
    const names = iconNames();
    const used = usedIcons();
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((name) => !names.includes(name))).toEqual([]);
  });

  it('loads text fonts from Google Fonts, not npm packages', () => {
    expect(indexHtml).toContain('family=Archivo');
    expect(indexHtml).toContain('family=IBM+Plex+Mono:wght@500');
    const styles = readFileSync('web/src/styles.scss', 'utf8');
    expect(styles).not.toContain('@fontsource');
    expect(styles).not.toContain('material-symbols');
  });
});
