import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { addOutputOnlyEnumTypes } from '../../scripts/config/sdk-enums.mjs';

const schema = `enum LocationKind { HQ SALON }
enum KnowledgeGeometryStatus {
  VERIFIED
  UNAVAILABLE
}`;

it('adds type-only string unions for output enum references absent from generated declarations', () => {
  const generated = `export type DateString = string;
export enum MemberRole { HQ = "HQ" }
export interface Source { kind: LocationKind; geometry: KnowledgeGeometryStatus; role: MemberRole }`;
  const result = addOutputOnlyEnumTypes(generated, schema);
  expect(result).toContain('export type LocationKind = "HQ" | "SALON";');
  expect(result).toContain('export type KnowledgeGeometryStatus = "VERIFIED" | "UNAVAILABLE";');
  expect(result).not.toContain('export type MemberRole');
  expect(addOutputOnlyEnumTypes(result, schema)).toBe(result);
});

it('does not invent a runtime enum export or add unused schema enums', () => {
  const result = addOutputOnlyEnumTypes(
    'export type DateString = string;\nexport interface Source { kind: LocationKind }',
    schema,
  );
  expect(result).not.toContain('export enum LocationKind');
  expect(result).not.toContain('KnowledgeGeometryStatus');
});

it('generated browser and admin declarations match their runtime enum exports', async () => {
  for (const base of ['web/src/app/core/generated', 'scripts/generated/browser']) {
    const declarations = await readFile(`${base}/index.d.ts`, 'utf8');
    const runtime = await readFile(`${base}/esm/index.esm.js`, 'utf8');
    for (const name of [
      'LocationKind',
      'KnowledgeProcessingStatus',
      'KnowledgeSourceType',
      'KnowledgeDocumentKind',
      'KnowledgeOrigin',
      'KnowledgeGeometryStatus',
      'StockActionType',
    ]) {
      expect(declarations).toMatch(new RegExp(`export type ${name} = `));
      expect(declarations).not.toMatch(new RegExp(`export enum ${name}\\b`));
      expect(runtime).not.toMatch(new RegExp(`export const ${name}\\b`));
    }
    expect(declarations).toMatch(/export enum MemberRole\b/);
    expect(runtime).toMatch(/export const MemberRole\b/);
  }
});
