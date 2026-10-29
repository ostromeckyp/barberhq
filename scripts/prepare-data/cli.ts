import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { buildSeed } from './catalog.ts';
const seed = buildSeed(JSON.parse(await readFile('docs/not-bad-stuff-products.json', 'utf8')));
await mkdir('data/seed', { recursive: true });
await writeFile('data/seed/business.json', JSON.stringify(seed, null, 2) + '\n');
console.log(
  `Prepared ${seed.products.length} products, ${seed.locations.length} locations, ${seed.inventory.length} synthetic inventory rows.`,
);
