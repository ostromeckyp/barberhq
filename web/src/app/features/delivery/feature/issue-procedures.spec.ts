import { expect, it } from 'vitest';
import type {
  DeliveryProcedureDto,
  DeliveryQuantities,
} from '../../../../../../shared/contracts/delivery/index';
import { issueProcedures } from './issue-procedures';

const procedure = (kind: 'DAMAGED' | 'MISSING'): DeliveryProcedureDto => ({
  kind,
  documentId: `doc-${kind}`,
  revision: 1,
  availability: 'AVAILABLE',
  reference: { kind, versionId: `v-${kind}` },
  title: kind,
});
const both = [procedure('DAMAGED'), procedure('MISSING')];
const row = (damaged: number, missing: number, productId = 'p'): DeliveryQuantities => ({
  productId,
  goodQuantity: 8,
  damagedQuantity: damaged,
  missingQuantity: missing,
});
const kinds = (list: DeliveryProcedureDto[]) => list.map((p) => p.kind);

it('offers only the damaged product procedure when units arrived damaged', () => {
  expect(kinds(issueProcedures(both, [row(2, 0)]))).toEqual(['DAMAGED']);
});

it('offers only the missing product procedure when units are missing', () => {
  expect(kinds(issueProcedures(both, [row(0, 2)]))).toEqual(['MISSING']);
});

it('offers both when the inspection found damaged and missing units, across products', () => {
  expect(kinds(issueProcedures(both, [row(1, 0, 'a'), row(0, 1, 'b')]))).toEqual([
    'DAMAGED',
    'MISSING',
  ]);
});

it('keeps an unassigned procedure for the reported problem so staff see who to contact', () => {
  const unassigned = { ...procedure('MISSING'), availability: 'MISSING' as const, reference: null };
  expect(issueProcedures([procedure('DAMAGED'), unassigned], [row(0, 3)])).toEqual([unassigned]);
});

it('falls back to every procedure when the inspection shows no problem quantities', () => {
  expect(kinds(issueProcedures(both, [row(0, 0)]))).toEqual(['DAMAGED', 'MISSING']);
});
