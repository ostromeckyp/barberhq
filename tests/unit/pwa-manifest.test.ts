import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const publicDir = join(__dirname, '../../web/public');
const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'));
const html = readFileSync(join(__dirname, '../../web/src/index.html'), 'utf8');

describe('PWA manifest', () => {
  it('has the install identity', () => {
    expect(manifest).toMatchObject({
      name: 'BarberHQ',
      short_name: 'BarberHQ',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      theme_color: '#171614',
      background_color: '#f6f5f2',
    });
  });

  it('lists any and maskable icons', () => {
    const has = (sizes: string, purpose: string) =>
      manifest.icons.some((i: any) => i.sizes === sizes && (i.purpose ?? 'any') === purpose);
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
  });

  it('points to existing PNGs whose size matches', () => {
    for (const icon of manifest.icons) {
      const file = join(publicDir, icon.src.replace(/^\//, ''));
      expect(existsSync(file), icon.src).toBe(true);
      const bytes = readFileSync(file);
      const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it('ships notification and touch icons', () => {
    const size = (p: string) => {
      const b = readFileSync(join(publicDir, p));
      return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
    };
    expect(size('icons/badge-72.png')).toBe('72x72');
    expect(size('icons/apple-touch-icon.png')).toBe('180x180');
  });

  it('declares install meta in index.html', () => {
    for (const tag of [
      '<link rel="manifest" href="manifest.webmanifest" />',
      '<meta name="theme-color" content="#171614" />',
      '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />',
      '<meta name="apple-mobile-web-app-capable" content="yes" />',
      '<meta name="apple-mobile-web-app-title" content="BarberHQ" />',
    ])
      expect(html).toContain(tag);
  });
});
