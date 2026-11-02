// Renders the PWA icons with Playwright Chromium. Run once, commit the PNGs:
//   node --import tsx scripts/dev/generate-pwa-icons.ts
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = join(import.meta.dirname, '../../web/public/icons');
const RED = '#dc241f';
const FONT = "Archivo, 'Helvetica Neue', Arial, sans-serif";

// `scale` is the glyph height as a share of the canvas; `bg` null means transparent.
const svg = (size: number, scale: number, bg: string | null, fill: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
  <text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="${fill}"
    font-family="${FONT}" font-weight="900" font-size="${scale * 100 * 1.4}" letter-spacing="-2">B</text>
</svg>`;

const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.5, bg: RED, fill: '#fff' },
  { file: 'icon-512.png', size: 512, scale: 0.5, bg: RED, fill: '#fff' },
  // Maskable: the mark stays inside the central 80 % safe zone.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.4, bg: RED, fill: '#fff' },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.5, bg: RED, fill: '#fff' },
  { file: 'badge-72.png', size: 72, scale: 0.6, bg: null, fill: '#fff' },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, size, scale, bg, fill } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg(size, scale, bg, fill)}</body>`,
    );
    await page.screenshot({ path: join(out, file), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
