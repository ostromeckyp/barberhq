import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repository = process.cwd();
const python = process.env.PDF_PYTHON ?? 'python3';
const exporter = resolve(repository, 'scripts/prepare-data/export-pdfs.py');

function hash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('pdf exporter provenance', () => {
  it('rejects changed source while preserving accepted bytes and restores a missing fixture', () => {
    const isolatedRoot = mkdtempSync(resolve(tmpdir(), 'barberhq-pdf-export-'));
    const sourcePath = resolve(repository, 'docs/synthetic-knowledge/damaged-delivery-v1.md');
    const isolatedSource = resolve(isolatedRoot, 'docs/synthetic-knowledge/damaged-delivery-v1.md');
    mkdirSync(resolve(isolatedRoot, 'docs/synthetic-knowledge'), { recursive: true });
    copyFileSync(sourcePath, isolatedSource);
    const acceptedPaths = [
      'data/knowledge/pdfs/DAM-001-v1.pdf',
      'data/knowledge/manifest.json',
      'data/knowledge/provenance/DAM-001-v1.json',
    ];
    const fixtureNames = ['geometry.pdf', 'scanned.pdf', 'mixed.pdf'];
    for (const relative of [
      ...acceptedPaths,
      ...fixtureNames.map((name) => `tests/fixtures/pdf/${name}`),
    ]) {
      const target = resolve(isolatedRoot, relative);
      mkdirSync(resolve(target, '..'), { recursive: true });
      copyFileSync(resolve(repository, relative), target);
    }

    const runExporter = () =>
      execFileSync(
        python,
        [exporter, '--document', 'DAM-001', '--version', 'v1', '--root', isolatedRoot],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    const isolatedPath = (relative: string) => resolve(isolatedRoot, relative);
    try {
      const accepted = acceptedPaths.map((path) => hash(isolatedPath(path)));
      const provenance = JSON.parse(
        readFileSync(isolatedPath('data/knowledge/provenance/DAM-001-v1.json'), 'utf8'),
      );
      expect(provenance).toMatchObject({
        documentId: 'DAM-001',
        version: 'v1',
        pdfSha256: accepted[0],
      });
      expect(provenance.sourceSha256).toMatch(/^[a-f0-9]{64}$/);

      const changedSource = readFileSync(isolatedSource, 'utf8').replace(
        'Do not mark an affected unit',
        'Mark an affected unit',
      );
      writeFileSync(isolatedSource, changedSource);
      let failure = '';
      try {
        runExporter();
      } catch (error) {
        failure = `${(error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr?.toString() ?? ''}${String(error)}`;
      }
      expect(failure).toContain('canonical authoring source changed');
      expect(failure).toContain('create v2');
      expect(
        [
          'data/knowledge/pdfs/DAM-001-v1.pdf',
          'data/knowledge/manifest.json',
          'data/knowledge/provenance/DAM-001-v1.json',
        ].map((path) => hash(isolatedPath(path))),
      ).toEqual(accepted);

      copyFileSync(sourcePath, isolatedSource);
      rmSync(isolatedPath('data/knowledge/provenance/DAM-001-v1.json'));
      let missingProvenanceFailure = '';
      try {
        runExporter();
      } catch (error) {
        missingProvenanceFailure = `${(error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr?.toString() ?? ''}${String(error)}`;
      }
      expect(missingProvenanceFailure).toContain('accepted PDF provenance is missing');
      expect(acceptedPaths.slice(0, 2).map((path) => hash(isolatedPath(path)))).toEqual(
        accepted.slice(0, 2),
      );
      copyFileSync(
        resolve(repository, 'data/knowledge/provenance/DAM-001-v1.json'),
        isolatedPath('data/knowledge/provenance/DAM-001-v1.json'),
      );
      const mixedFixture = isolatedPath('tests/fixtures/pdf/mixed.pdf');
      rmSync(mixedFixture);
      runExporter();
      expect(readFileSync(mixedFixture).subarray(0, 5).toString()).toBe('%PDF-');
      expect(acceptedPaths.map((path) => hash(isolatedPath(path)))).toEqual(accepted);
    } finally {
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  });

  it('preserves the full corpus on repeat export and refuses changed source without mutation', () => {
    const isolatedRoot = mkdtempSync(resolve(tmpdir(), 'barberhq-full-corpus-'));
    const files = [
      'docs/not-bad-stuff-products.json',
      'docs/synthetic-knowledge/damaged-delivery-v1.md',
      'docs/synthetic-knowledge/delivery-discrepancy-v1.md',
      'docs/synthetic-knowledge/routine-replenishment-v1.md',
      'docs/synthetic-knowledge/damaged-delivery-v0-retired.md',
      'data/knowledge/manifest.json',
      'data/knowledge/pdfs/DAM-001-v1.pdf',
      'data/knowledge/pdfs/DIS-001-v1.pdf',
      'data/knowledge/pdfs/REP-001-v1.pdf',
      'data/knowledge/pdfs/DAM-001-v0.pdf',
      'data/knowledge/provenance/DAM-001-v1.json',
      'data/knowledge/provenance/DIS-001-v1.json',
      'data/knowledge/provenance/REP-001-v1.json',
      'data/knowledge/provenance/DAM-001-v0.json',
    ];
    for (const relative of files) {
      const target = resolve(isolatedRoot, relative);
      mkdirSync(resolve(target, '..'), { recursive: true });
      copyFileSync(resolve(repository, relative), target);
    }
    const runAll = () =>
      execFileSync(python, [exporter, '--all', '--root', isolatedRoot], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    const identities = () =>
      files
        .filter((path) => path.startsWith('data/knowledge/'))
        .map((path) => hash(resolve(isolatedRoot, path)));
    try {
      const accepted = identities();
      runAll();
      expect(identities()).toEqual(accepted);

      const discrepancySource = resolve(
        isolatedRoot,
        'docs/synthetic-knowledge/delivery-discrepancy-v1.md',
      );
      writeFileSync(
        discrepancySource,
        readFileSync(discrepancySource, 'utf8').replace(
          'An absent item is a delivery discrepancy',
          'An absent item is damage',
        ),
      );
      let failure = '';
      try {
        runAll();
      } catch (error) {
        failure = `${(error as NodeJS.ErrnoException & { stderr?: Buffer }).stderr?.toString() ?? ''}${String(error)}`;
      }
      expect(failure).toContain('source/provenance identity changed for DIS-001 v1');
      expect(identities()).toEqual(accepted);
    } finally {
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  });
});
