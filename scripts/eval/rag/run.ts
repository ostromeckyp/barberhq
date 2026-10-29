import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedDocumentHit,
  expectedEvidenceHit,
  loadRagCases,
  validateHits,
  validateReplayCases,
  type RagHit,
} from './calibrate.js';

/** Retrieval-only evaluation; generated claims are outside Task 1. */
export async function runRetrievalEvaluation(input: {
  embeddingConfigHash: string;
  evaluationSetHash: string;
  maxCosineDistance: number;
  retrieveCandidates(question: string): Promise<RagHit[]>;
  casesPath?: string;
  outputPath?: string;
}) {
  if (
    !/^[a-f0-9]{64}$/.test(input.embeddingConfigHash) ||
    !Number.isFinite(input.maxCosineDistance) ||
    input.maxCosineDistance < 0 ||
    input.maxCosineDistance > 2
  )
    throw new Error('Invalid retrieval configuration');
  const { set, hash } = await loadRagCases(input.casesPath);
  if (hash !== input.evaluationSetHash) throw new Error('Evaluation set hash mismatch');
  const cases = [];
  for (const c of set.cases) {
    const hits = validateHits(await input.retrieveCandidates(c.question));
    const accepted = hits.filter((h) => h.cosineDistance <= input.maxCosineDistance);
    cases.push({
      ...c,
      hits,
      acceptedChunkIds: accepted.map((h) => h.chunkId),
      expectedSectionHit: expectedEvidenceHit(c, accepted),
      expectedDocumentHit: expectedDocumentHit(c, accepted),
      noEvidence: accepted.length === 0,
    });
  }
  const report = {
    scope: 'retrieval-only; no answer generation or claim-support verdict',
    distanceSemantics: 'pgvector cosine distance (<=>); smaller is closer',
    embeddingConfigHash: input.embeddingConfigHash,
    evaluationSetHash: hash,
    maxCosineDistance: input.maxCosineDistance,
    cases,
    limitations: [
      'A close citation may support only part of a question; answer-level abstention requires claim review.',
      'Polish probes do not enable Polish output.',
    ],
  };
  if (input.outputPath) await writeFile(input.outputPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output')
    throw new Error(
      'Usage: npm run eval:rag -- --input <calibration-report.json> --output <evaluation-report.json>',
    );
  const measured: unknown = JSON.parse(await readFile(args[1], 'utf8'));
  if (!measured || typeof measured !== 'object' || Array.isArray(measured))
    throw new Error('Invalid calibration report');
  const source = measured as {
    embeddingConfigHash?: string;
    evaluationSetHash?: string;
    chosenThreshold?: number;
  };
  if (
    !source.embeddingConfigHash ||
    !source.evaluationSetHash ||
    source.chosenThreshold === undefined
  )
    throw new Error('Invalid calibration report');
  const { set, hash } = await loadRagCases();
  const byId = validateReplayCases(measured, set, hash);
  const byQuestion = new Map(set.cases.map((c) => [c.question, c.id]));
  const report = await runRetrievalEvaluation({
    embeddingConfigHash: source.embeddingConfigHash,
    evaluationSetHash: source.evaluationSetHash,
    maxCosineDistance: source.chosenThreshold,
    retrieveCandidates: async (question) => {
      const id = byQuestion.get(question);
      if (!id || !byId.has(id)) throw new Error('Missing measured case');
      return byId.get(id)!;
    },
    outputPath: args[3],
  });
  process.stdout.write(
    `Retrieval-only evaluation wrote ${args[3]}; ${report.cases.length} cases.\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write(
      'Retrieval-only evaluation failed; inspect validated inputs and explicit output path.\n',
    );
    process.exitCode = 1;
  });
}
