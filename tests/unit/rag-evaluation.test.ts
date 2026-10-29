import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  loadRagCases,
  runCalibration,
  validateReplayCases,
} from '../../scripts/eval/rag/calibrate.ts';
import { runRetrievalEvaluation } from '../../scripts/eval/rag/run.ts';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

it('wrong_section_in_right_document_does_not_count_as_supported_evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rag-section-'));
  dirs.push(dir);
  const casesPath = join(dir, 'cases.json');
  await writeFile(
    casesPath,
    JSON.stringify({
      version: 1,
      cases: [
        {
          id: 'decision',
          split: 'calibration',
          question: 'Is replacement automatic?',
          support: 'supported',
          expectedDocumentCodes: ['DAM-001'],
          expectedEvidence: [{ documentCode: 'DAM-001', sectionId: 'decision' }],
        },
        {
          id: 'absent',
          split: 'calibration',
          question: 'What is the legal deadline?',
          support: 'unsupported',
          expectedDocumentCodes: [],
          expectedEvidence: [],
        },
      ],
    }),
  );
  const retrieveCandidates = async (question: string) =>
    question.includes('replacement')
      ? [
          {
            chunkId: 'wrong',
            versionId: 'business:DAM-001:v1',
            documentId: 'business:DAM-001',
            sectionId: 'intake',
            cosineDistance: 0.1,
          },
          {
            chunkId: 'right',
            versionId: 'business:DAM-001:v1',
            documentId: 'business:DAM-001',
            sectionId: 'decision',
            cosineDistance: 0.4,
          },
        ]
      : [
          {
            chunkId: 'noise',
            versionId: 'business:DAM-001:v1',
            documentId: 'business:DAM-001',
            sectionId: 'intake',
            cosineDistance: 0.8,
          },
        ];
  const report = await runCalibration({
    embeddingConfigHash: 'a'.repeat(64),
    casesPath,
    retrieveCandidates,
  });
  expect(report.chosenThreshold).toBe(0.4);
  expect(report.cases[0]).toHaveProperty('expectedSectionHit', true);
  expect(report.cases[0]).toHaveProperty('expectedDocumentHit', true);
  const tooLow = await runRetrievalEvaluation({
    embeddingConfigHash: 'a'.repeat(64),
    casesPath,
    evaluationSetHash: report.evaluationSetHash,
    maxCosineDistance: 0.1,
    retrieveCandidates,
  });
  expect(tooLow.cases[0]).toMatchObject({ expectedSectionHit: false, expectedDocumentHit: true });
});

it('replay_rejects_changed_question_same_id_duplicate_and_extraneous_ids', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rag-replay-'));
  dirs.push(dir);
  const casesPath = join(dir, 'cases.json');
  await writeFile(
    casesPath,
    JSON.stringify({
      version: 1,
      cases: [
        {
          id: 'one',
          split: 'calibration',
          question: 'Original question?',
          support: 'supported',
          expectedDocumentCodes: ['DAM-001'],
          expectedEvidence: [{ documentCode: 'DAM-001', sectionId: 'decision' }],
        },
        {
          id: 'two',
          split: 'heldout',
          question: 'Other question?',
          support: 'unsupported',
          expectedDocumentCodes: [],
          expectedEvidence: [],
        },
      ],
    }),
  );
  const { set, hash } = await loadRagCases(casesPath);
  const first = { id: 'one', question: 'Original question?', hits: [] };
  const second = { id: 'two', question: 'Other question?', hits: [] };
  const embeddingConfigHash = 'a'.repeat(64);
  expect(() =>
    validateReplayCases(
      { embeddingConfigHash, evaluationSetHash: hash, cases: [first, second] },
      set,
      hash,
    ),
  ).not.toThrow();
  expect(() =>
    validateReplayCases(
      { embeddingConfigHash, evaluationSetHash: 'b'.repeat(64), cases: [first, second] },
      set,
      hash,
    ),
  ).toThrow();
  expect(() =>
    validateReplayCases(
      {
        embeddingConfigHash,
        evaluationSetHash: hash,
        cases: [{ ...first, question: 'Changed question?' }, second],
      },
      set,
      hash,
    ),
  ).toThrow();
  expect(() =>
    validateReplayCases(
      { embeddingConfigHash, evaluationSetHash: hash, cases: [first, first] },
      set,
      hash,
    ),
  ).toThrow();
  expect(() =>
    validateReplayCases(
      { embeddingConfigHash, evaluationSetHash: hash, cases: [first] },
      set,
      hash,
    ),
  ).toThrow();
  expect(() =>
    validateReplayCases(
      {
        embeddingConfigHash,
        evaluationSetHash: hash,
        cases: [first, second, { id: 'extra', question: 'Extra?', hits: [] }],
      },
      set,
      hash,
    ),
  ).toThrow();
  expect(() =>
    validateReplayCases(
      {
        embeddingConfigHash,
        evaluationSetHash: hash,
        cases: [
          {
            ...first,
            hits: [{ chunkId: 'x', versionId: 'v', documentId: 'd', cosineDistance: 0.1 }],
          },
          second,
        ],
      },
      set,
      hash,
    ),
  ).toThrow();
});
