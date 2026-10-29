import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RagCase = {
  id: string;
  split: 'calibration' | 'heldout' | 'polish-probe';
  question: string;
  support: 'supported' | 'unsupported' | 'mixed';
  expectedDocumentCodes: string[];
  /** Every labeled section is needed; chunkId narrows broad sections to one passage. */
  expectedEvidence: { documentCode: string; sectionId: string; chunkId?: string }[];
};
export type RagHit = {
  chunkId: string;
  versionId: string;
  documentId: string;
  sectionId: string;
  cosineDistance: number;
};
export type RagObservation = RagCase & { hits: RagHit[] };
export type RagCases = { version: 1; cases: RagCase[] };

/** Bind every measured vector result to the exact labeled question set. */
export function validateReplayCases(
  source: unknown,
  set: RagCases,
  hash: string,
): Map<string, RagHit[]> {
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw new Error('Invalid measured replay');
  const replay = source as {
    embeddingConfigHash?: unknown;
    evaluationSetHash?: unknown;
    cases?: unknown;
  };
  if (
    typeof replay.embeddingConfigHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(replay.embeddingConfigHash) ||
    replay.evaluationSetHash !== hash ||
    !Array.isArray(replay.cases) ||
    replay.cases.length !== set.cases.length
  )
    throw new Error('Measured replay identity mismatch');
  const expected = new Map(set.cases.map((c) => [c.id, c.question]));
  const byId = new Map<string, RagHit[]>();
  for (const value of replay.cases) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid measured case');
    const c = value as { id?: unknown; question?: unknown; hits?: unknown };
    if (
      typeof c.id !== 'string' ||
      typeof c.question !== 'string' ||
      !expected.has(c.id) ||
      c.question !== expected.get(c.id) ||
      byId.has(c.id)
    )
      throw new Error('Measured case identity mismatch');
    byId.set(c.id, validateHits(c.hits as RagHit[]));
  }
  if (byId.size !== expected.size) throw new Error('Missing measured case');
  return byId;
}

export async function loadRagCases(
  path = fileURLToPath(new URL('./cases.json', import.meta.url)),
): Promise<{ set: RagCases; hash: string }> {
  const raw = await readFile(path, 'utf8');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid RAG case set');
  const set = value as RagCases;
  if (
    set.version !== 1 ||
    !Array.isArray(set.cases) ||
    set.cases.length < 1 ||
    new Set(set.cases.map((c) => c.id)).size !== set.cases.length ||
    new Set(set.cases.map((c) => c.question)).size !== set.cases.length ||
    set.cases.some(
      (c) =>
        !c.id ||
        !c.question ||
        !['calibration', 'heldout', 'polish-probe'].includes(c.split) ||
        !['supported', 'unsupported', 'mixed'].includes(c.support) ||
        !Array.isArray(c.expectedDocumentCodes) ||
        !Array.isArray(c.expectedEvidence) ||
        c.expectedEvidence.some(
          (e) =>
            !e ||
            typeof e.documentCode !== 'string' ||
            !c.expectedDocumentCodes.includes(e.documentCode) ||
            typeof e.sectionId !== 'string' ||
            !e.sectionId ||
            (e.chunkId !== undefined && (typeof e.chunkId !== 'string' || !e.chunkId)),
        ) ||
        (c.support === 'supported' &&
          (c.expectedDocumentCodes.length === 0 || c.expectedEvidence.length === 0)) ||
        (c.support === 'unsupported' &&
          (c.expectedDocumentCodes.length !== 0 || c.expectedEvidence.length !== 0)),
    )
  )
    throw new Error('Invalid RAG case set');
  return { set, hash: createHash('sha256').update(JSON.stringify(set)).digest('hex') };
}

export function validateHits(hits: RagHit[]): RagHit[] {
  if (
    !Array.isArray(hits) ||
    hits.length > 3 ||
    hits.some(
      (h) =>
        !h ||
        typeof h.chunkId !== 'string' ||
        !h.chunkId ||
        typeof h.versionId !== 'string' ||
        !h.versionId ||
        typeof h.documentId !== 'string' ||
        !h.documentId ||
        typeof h.sectionId !== 'string' ||
        !h.sectionId ||
        typeof h.cosineDistance !== 'number' ||
        !Number.isFinite(h.cosineDistance) ||
        h.cosineDistance < 0 ||
        h.cosineDistance > 2,
    )
  )
    throw new Error('Invalid retrieval observations');
  return hits.map((h) => ({
    chunkId: h.chunkId,
    versionId: h.versionId,
    documentId: h.documentId,
    sectionId: h.sectionId,
    cosineDistance: h.cosineDistance,
  }));
}

export function observedDocumentCode(documentId: string): string {
  return documentId.slice(documentId.lastIndexOf(':') + 1);
}

function accepted(o: RagObservation, threshold: number): RagHit[] {
  return o.hits.filter((h) => h.cosineDistance <= threshold);
}
export function expectedEvidenceHit(o: RagCase, hits: RagHit[]): boolean {
  return (
    o.expectedEvidence.length > 0 &&
    o.expectedEvidence.every((e) =>
      hits.some(
        (h) =>
          observedDocumentCode(h.documentId) === e.documentCode &&
          h.sectionId === e.sectionId &&
          (e.chunkId === undefined || h.chunkId === e.chunkId),
      ),
    )
  );
}
export function expectedDocumentHit(o: RagCase, hits: RagHit[]): boolean {
  return hits.some((h) => o.expectedDocumentCodes.includes(observedDocumentCode(h.documentId)));
}
function score(observations: RagObservation[], threshold: number) {
  const positives = observations.filter(
    (o) => o.split === 'calibration' && o.support === 'supported',
  );
  const negatives = observations.filter(
    (o) => o.split === 'calibration' && o.support === 'unsupported',
  );
  const sectionRecalled = positives.filter((o) =>
    expectedEvidenceHit(o, accepted(o, threshold)),
  ).length;
  const documentRecalled = positives.filter((o) =>
    expectedDocumentHit(o, accepted(o, threshold)),
  ).length;
  const rejected = negatives.filter((o) => accepted(o, threshold).length === 0).length;
  return {
    supportedCases: positives.length,
    supportedSectionRecall: positives.length ? sectionRecalled / positives.length : 0,
    supportedDocumentRecall: positives.length ? documentRecalled / positives.length : 0,
    unsupportedCases: negatives.length,
    unsupportedRejection: negatives.length ? rejected / negatives.length : 0,
  };
}
function splitMetrics(observations: RagObservation[], split: RagCase['split'], threshold: number) {
  const subset = observations.filter((o) => o.split === split);
  const supported = subset.filter((o) => o.support === 'supported');
  const unsupported = subset.filter((o) => o.support === 'unsupported');
  const mixed = subset.filter((o) => o.support === 'mixed');
  return {
    supported: {
      total: supported.length,
      expectedSectionHits: supported.filter((o) => expectedEvidenceHit(o, accepted(o, threshold)))
        .length,
      expectedDocumentHits: supported.filter((o) => expectedDocumentHit(o, accepted(o, threshold)))
        .length,
    },
    unsupported: {
      total: unsupported.length,
      noEvidence: unsupported.filter((o) => accepted(o, threshold).length === 0).length,
    },
    mixed: {
      total: mixed.length,
      noEvidence: mixed.filter((o) => accepted(o, threshold).length === 0).length,
    },
  };
}

/** Inject the real retrieval call or replay measured candidates; this function does no provider/SQL setup. */
export async function runCalibration(input: {
  embeddingConfigHash: string;
  retrieveCandidates(question: string): Promise<RagHit[]>;
  casesPath?: string;
  outputPath?: string;
}): Promise<{
  evaluationSetHash: string;
  embeddingConfigHash: string;
  distanceSemantics: string;
  chosenThreshold: number | null;
  rationale: string;
  calibrationMetrics: ReturnType<typeof score> | null;
  splitMetrics: Record<RagCase['split'], ReturnType<typeof splitMetrics>> | null;
  cases: (RagObservation & {
    acceptedChunkIds: string[];
    expectedSectionHit: boolean;
    expectedDocumentHit: boolean;
  })[];
  limitations: string[];
}> {
  if (!/^[a-f0-9]{64}$/.test(input.embeddingConfigHash))
    throw new Error('Invalid embedding config hash');
  const { set, hash } = await loadRagCases(input.casesPath);
  const observations: RagObservation[] = [];
  for (const c of set.cases)
    observations.push({ ...c, hits: validateHits(await input.retrieveCandidates(c.question)) });
  const calibration = observations.filter((o) => o.split === 'calibration');
  const positives = calibration.filter((o) => o.support === 'supported');
  const negatives = calibration.filter((o) => o.support === 'unsupported');
  let chosenThreshold: number | null = null;
  let metrics: ReturnType<typeof score> | null = null;
  if (
    positives.length &&
    negatives.length &&
    positives.some((o) => expectedEvidenceHit(o, o.hits))
  ) {
    const thresholds = [
      ...new Set([0, ...calibration.flatMap((o) => o.hits.map((h) => h.cosineDistance)), 2]),
    ].sort((a, b) => a - b);
    for (const t of thresholds) {
      const candidate = score(calibration, t);
      const quality = Math.min(candidate.supportedSectionRecall, candidate.unsupportedRejection);
      const previous = metrics
        ? Math.min(metrics.supportedSectionRecall, metrics.unsupportedRejection)
        : -1;
      if (
        quality > previous ||
        (quality === previous &&
          metrics &&
          candidate.supportedSectionRecall + candidate.unsupportedRejection >
            metrics.supportedSectionRecall + metrics.unsupportedRejection)
      ) {
        chosenThreshold = t;
        metrics = candidate;
      }
    }
  }
  const cases = observations.map((o) => {
    const kept = chosenThreshold === null ? [] : accepted(o, chosenThreshold);
    return {
      ...o,
      acceptedChunkIds: kept.map((h) => h.chunkId),
      expectedSectionHit: expectedEvidenceHit(o, kept),
      expectedDocumentHit: expectedDocumentHit(o, kept),
    };
  });
  const limitations = [
    'Cosine distance ranks related text; it does not establish that a source supports every requested claim.',
    'Mixed questions require claim-level abstention even if their supported part retrieves a close source.',
    'Held-out and Polish probes are reported only; they do not tune the threshold or enable Polish answers.',
  ];
  if (chosenThreshold === null)
    limitations.push('No usable threshold could be selected from the calibration observations.');
  if (metrics && (metrics.supportedSectionRecall < 1 || metrics.unsupportedRejection < 1))
    limitations.push(
      'Some calibration cases miss expected sections because of top-three ranking, the distance cutoff, or overlap; inspect each candidate list before claiming usable evidence.',
    );
  const report = {
    evaluationSetHash: hash,
    embeddingConfigHash: input.embeddingConfigHash,
    distanceSemantics:
      'pgvector cosine distance (<=>); smaller is closer; candidates are limited to three after SQL eligibility filtering',
    chosenThreshold,
    rationale:
      'Threshold chosen from calibration distances by maximizing the weaker of expected-section recall and unsupported rejection, then their sum; ties use the lower distance. All labeled sections must be present, with exact chunk ID where specified. Document recall is diagnostic only. Mixed, held-out and Polish cases do not tune it.',
    calibrationMetrics: metrics,
    splitMetrics:
      chosenThreshold === null
        ? null
        : {
            calibration: splitMetrics(observations, 'calibration', chosenThreshold),
            heldout: splitMetrics(observations, 'heldout', chosenThreshold),
            'polish-probe': splitMetrics(observations, 'polish-probe', chosenThreshold),
          },
    cases,
    limitations,
  };
  if (input.outputPath) await writeFile(input.outputPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output')
    throw new Error(
      'Usage: npm run eval:rag:calibrate -- --input <measured-candidates.json> --output <report.json>',
    );
  const measured: unknown = JSON.parse(await readFile(args[1], 'utf8'));
  const { set, hash } = await loadRagCases();
  const byId = validateReplayCases(measured, set, hash);
  const source = measured as { embeddingConfigHash: string };
  const byQuestion = new Map(set.cases.map((c) => [c.question, c.id]));
  const report = await runCalibration({
    embeddingConfigHash: source.embeddingConfigHash,
    retrieveCandidates: async (question) => {
      const id = byQuestion.get(question);
      if (!id || !byId.has(id)) throw new Error('Missing measured case');
      return byId.get(id)!;
    },
    outputPath: args[3],
  });
  process.stdout.write(
    `Retrieval calibration wrote ${args[3]}; threshold ${report.chosenThreshold ?? 'unresolved'}; evaluation set ${report.evaluationSetHash}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write(
      'Retrieval calibration failed; inspect validated inputs and explicit output path.\n',
    );
    process.exitCode = 1;
  });
}
