import type {
  DeliveryProblemKind,
  DeliveryProcedureDto,
  DeliveryQuantities,
} from '../../../../../../shared/contracts/delivery/index';

/**
 * Procedures for the problems the original inspection found: damaged units → damaged product
 * procedure, missing units → missing product procedure. Every procedure when it found neither.
 */
export function issueProcedures(
  procedures: DeliveryProcedureDto[],
  inspected: DeliveryQuantities[],
): DeliveryProcedureDto[] {
  const kinds = new Set<DeliveryProblemKind>();
  for (const row of inspected) {
    if (row.damagedQuantity > 0) kinds.add('DAMAGED');
    if (row.missingQuantity > 0) kinds.add('MISSING');
  }
  return kinds.size ? procedures.filter((procedure) => kinds.has(procedure.kind)) : procedures;
}
