import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { chunkPages } from '../../functions/src/knowledge/chunk.js';
import { extractPdf } from '../../functions/src/knowledge/extract.js';

const input = resolve(process.argv[2] ?? 'data/knowledge/pdfs/DAM-001-v1.pdf');
const outputDirectory = resolve('artifacts/knowledge-extraction');
const name = basename(input).replace(/\.pdf$/i, '');
const output = resolve(outputDirectory, `${name}.json`);

const document = await extractPdf(new Uint8Array(await readFile(input)));
const chunks = chunkPages(document);
await mkdir(outputDirectory, { recursive: true });
await writeFile(output, `${JSON.stringify({ document, chunks }, null, 2)}\n`, 'utf8');
process.stdout.write(`${output}\n`);
