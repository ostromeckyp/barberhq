import type { DeliveryProblemKind } from './delivery-problem-kind.js';
export type ProcedureReference = { kind: DeliveryProblemKind; versionId: string; chunkId?: string };
