import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createEmbeddingConfig,
  createVertexEmbeddingAdapter,
} from '../../functions/src/knowledge/embedding.js';

const args = parseArgs(process.argv.slice(2));
const config = createEmbeddingConfig({
  projectId: required(args, 'project'),
  location: required(args, 'location'),
  modelId: required(args, 'model'),
  dimension: parseDimension(required(args, 'dimension')),
  documentMode: 'RETRIEVAL_DOCUMENT',
  queryMode: 'RETRIEVAL_QUERY',
});

const adapter = createVertexEmbeddingAdapter(config);
// Keep the actual provider calls sequential and small to avoid hidden retry or batch loops.
const documentVectors = await adapter.embedTexts(
  ['A matte styling paste gives hair a natural finish.'],
  'document',
);
const queryVectors = await adapter.embedTexts(
  ['Jak uzyskać naturalne, matowe wykończenie fryzury?'],
  'query',
);

const verifiedAt = new Date().toISOString();
const record = {
  verifiedAt,
  config,
  checks: {
    document: { count: documentVectors.length, dimension: documentVectors[0].length },
    query: { count: queryVectors.length, dimension: queryVectors[0].length },
  },
};
const outputDirectory = resolve('artifacts/embedding-check');
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'verification.json'),
  `${JSON.stringify(record, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(
  `Embedding preflight passed: provider=vertex model=${config.modelId} dimension=${config.dimension} document=1 query=1 configHash=${config.configHash}`,
);

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--project', '--location', '--model', '--dimension'].includes(key)) {
      throw new Error(`Unknown argument: ${key}\n${usage()}`);
    }
    if (parsed[key.slice(2)] || !argv[index + 1] || argv[index + 1].startsWith('--')) {
      throw new Error(`Missing or duplicate value for ${key}\n${usage()}`);
    }
    parsed[key.slice(2)] = argv[++index];
  }
  for (const field of ['project', 'location', 'model', 'dimension']) required(parsed, field);
  return parsed;
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key]?.trim();
  if (!value) throw new Error(`--${key} is required\n${usage()}`);
  return value;
}

function parseDimension(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error('--dimension must be a positive integer');
  return Number(value);
}

function usage(): string {
  return 'Usage: node --import tsx scripts/checks/embedding.ts --project PROJECT --location LOCATION --model MODEL --dimension DIMENSION';
}
