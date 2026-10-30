import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = 'web/src/app';
const i18nRoot = 'web/public/i18n';
// The whole app (generated code and specs are skipped) must not contain hard-coded text.
const migratedAreas = ['.'];
const namespaces =
  'common|shell|auth|login|access|procedures|replenishment|requests|delivery|salon|hq';
const keyLiteralPattern = new RegExp(
  `(['"\`])((?:${namespaces})\\.[A-Za-z0-9_.-]*[A-Za-z0-9_-])\\1`,
  'g',
);
const translatedAttributes = ['aria-label', 'placeholder', 'matTooltip'];

type Json = { [key: string]: Json | string };

function flatten(value: Json, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') {
      for (const [k, v] of flatten(child, path)) out.set(k, v);
    } else out.set(path, child);
  }
  return out;
}

function readTranslations(lang: string): Map<string, unknown> {
  const file = join(i18nRoot, `${lang}.json`);
  if (!existsSync(file)) throw new Error(`${file} is missing`);
  return flatten(JSON.parse(readFileSync(file, 'utf8')) as Json);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return /^generated/.test(entry.name) ? [] : sourceFiles(path);
    return /\.(ts|html)$/.test(entry.name) ? [path] : [];
  });
}

/** Quoted key literals anywhere, including inside attribute values and inline templates. */
function literalKeys(source: string): string[] {
  return [...source.matchAll(keyLiteralPattern)].map((m) => m[2]);
}

/** Inline `template:` strings of a component file. */
function inlineTemplates(source: string): string[] {
  return [...source.matchAll(/\btemplate:\s*`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1]);
}

/** Removes Angular control-flow syntax (`@if (...) {`, `} @else {`, `@let x = y;`, `}`). */
function stripControlFlow(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const block = /^@[a-zA-Z]+(\s+if)?/.exec(text.slice(i));
    if (!block) {
      out += text[i] === '{' || text[i] === '}' ? ' ' : text[i];
      i++;
      continue;
    }
    if (block[0] === '@let') {
      const end = text.indexOf(';', i);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    i += block[0].length;
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] === '(') {
      let depth = 0;
      for (; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')' && --depth === 0) {
          i++;
          break;
        }
      }
    }
  }
  return out;
}

/** Hard-coded text nodes and translatable attributes in an Angular template. */
function hardCodedText(template: string): string[] {
  const html = template
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/<mat-icon\b[^>]*>[\s\S]*?<\/mat-icon\s*>/g, ' ');
  const found: string[] = [];
  let text = '';
  const flush = () => {
    const value = stripControlFlow(text)
      .replace(/&[#\w]+;/g, ' ')
      .trim();
    if (/\p{L}/u.test(value)) found.push(value.replace(/\s+/g, ' '));
    text = '';
  };
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<' && /[a-zA-Z/!]/.test(html[i + 1] ?? '')) {
      flush();
      let quote = '';
      const start = i;
      for (; i < html.length; i++) {
        const c = html[i];
        if (quote) {
          if (c === quote) quote = '';
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
      }
      const tag = html.slice(start, i + 1);
      for (const name of translatedAttributes) {
        const attr = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
        if (attr && /\p{L}/u.test(attr[1])) found.push(`${name}="${attr[1]}"`);
      }
    } else text += html[i];
  }
  flush();
  return found;
}

describe('i18n keys', () => {
  it('en and pl have the same keys and no empty strings', () => {
    const en = readTranslations('en');
    const pl = readTranslations('pl');
    const problems = [
      ...[...en.keys()].filter((k) => !pl.has(k)).map((k) => `pl.json is missing ${k}`),
      ...[...pl.keys()].filter((k) => !en.has(k)).map((k) => `en.json is missing ${k}`),
      ...[...en, ...pl]
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => `${k} must be a non-empty string`),
    ];
    expect(problems).toEqual([]);
  });

  it('finds keys inside bound attributes and inline templates', () => {
    expect(literalKeys(`[attr.aria-label]="'shell.missing' | transloco"`)).toEqual([
      'shell.missing',
    ]);
    const component = "template: `<p>{{ 'login.missing' | transloco }}</p>`, x: `hq.a.b`";
    expect(literalKeys(component)).toEqual(['login.missing', 'hq.a.b']);
    expect(literalKeys(`'shell.nav.' + name, "salon.name.length > 0 ? x : y"`)).toEqual([]);
  });

  it('every literal key used by the web app exists in en.json', () => {
    const en = readTranslations('en');
    const problems: string[] = [];
    for (const file of sourceFiles(appRoot)) {
      if (file.endsWith('.spec.ts')) continue;
      for (const key of literalKeys(readFileSync(file, 'utf8'))) {
        if (!en.has(key) && !en.has(`${key}.one`)) {
          problems.push(`${relative(appRoot, file)}: ${key}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('migrated areas have no hard-coded template text', () => {
    const problems: string[] = [];
    for (const area of migratedAreas) {
      for (const file of sourceFiles(join(appRoot, area))) {
        if (file.endsWith('.spec.ts')) continue;
        const source = readFileSync(file, 'utf8');
        const templates = file.endsWith('.html') ? [source] : inlineTemplates(source);
        for (const text of templates.flatMap(hardCodedText)) {
          problems.push(`${relative(appRoot, file)}: ${text}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('route titles are translation keys', () => {
    const routes = readFileSync(join(appRoot, 'app.routes.ts'), 'utf8');
    const titles = [...routes.matchAll(/\btitle:\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.filter((t) => !/^shell\.titles\.[A-Za-z]+$/.test(t))).toEqual([]);
  });
});
