import { knowledgeKinds, knowledgeOrigins } from '../../../../shared/knowledge-metadata';
import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import type {
  ProcedureInput,
  ProcedureResult,
  AiOperationalCode,
  PrepareInput,
  ProposalResult,
} from '../../../../shared/contracts/ai/index';
import { FIREBASE } from './firebase.providers';
import { isReplenishmentProposal } from './replenishment-proposal';

export type AssistantErrorCode =
  AiOperationalCode | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR';

const UNAVAILABLE = 'procedures.assistant.errors.UNAVAILABLE';
/** Translation key of the user-facing message for each error code. */
const messages: Record<AssistantErrorCode, string> = {
  UNAUTHENTICATED: 'procedures.assistant.errors.UNAUTHENTICATED',
  FORBIDDEN: 'procedures.assistant.errors.FORBIDDEN',
  VALIDATION_ERROR: 'procedures.assistant.errors.VALIDATION_ERROR',
  RATE_LIMITED: 'procedures.assistant.errors.RATE_LIMITED',
  TIMEOUT: 'procedures.assistant.errors.TIMEOUT',
  PROVIDER_UNAVAILABLE: UNAVAILABLE,
  SERVICE_UNAVAILABLE: UNAVAILABLE,
  SOURCE_CHANGED: 'procedures.assistant.errors.SOURCE_CHANGED',
  INVALID_MODEL_OUTPUT: 'procedures.assistant.errors.INVALID_MODEL_OUTPUT',
  EMBEDDING_CONFIG_MISMATCH: UNAVAILABLE,
};

export class AssistantApiError extends Error {
  /** Translation key of the message to show; `message` carries the same key. */
  readonly key: string;
  constructor(readonly code: AssistantErrorCode) {
    super(messages[code]);
    this.key = messages[code];
  }
}

function isProcedureResult(value: unknown): value is ProcedureResult {
  if (!value || typeof value !== 'object' || !('status' in value)) return false;
  const result = value as {
    status?: unknown;
    question?: unknown;
    message?: unknown;
    sources?: unknown;
    steps?: unknown;
    missingInformation?: unknown;
  };
  if (result.status === 'NEEDS_CLARIFICATION')
    return (
      typeof result.question === 'string' &&
      Array.isArray(result.sources) &&
      result.sources.length === 0
    );
  if (result.status === 'INSUFFICIENT_EVIDENCE')
    return (
      typeof result.message === 'string' &&
      Array.isArray(result.sources) &&
      result.sources.length === 0
    );
  if (
    result.status !== 'ANSWER' ||
    !Array.isArray(result.steps) ||
    !Array.isArray(result.sources) ||
    !Array.isArray(result.missingInformation)
  )
    return false;
  const sourceIds = new Set<string>();
  for (const item of result.sources) {
    if (!item || typeof item !== 'object') return false;
    const source = item as {
      chunkId?: unknown;
      sourceSectionId?: unknown;
      versionId?: unknown;
      title?: unknown;
      version?: unknown;
      excerpt?: unknown;
      physicalPage?: unknown;
      synthetic?: unknown;
      superseded?: unknown;
      kind?: unknown;
      origin?: unknown;
    };
    if (
      typeof source.chunkId !== 'string' ||
      !source.chunkId ||
      source.sourceSectionId !== source.chunkId ||
      typeof source.versionId !== 'string' ||
      !source.versionId ||
      typeof source.title !== 'string' ||
      typeof source.version !== 'string' ||
      typeof source.excerpt !== 'string' ||
      !Number.isSafeInteger(source.physicalPage) ||
      Number(source.physicalPage) < 1 ||
      typeof source.synthetic !== 'boolean' ||
      typeof source.superseded !== 'boolean' ||
      !knowledgeKinds.some((k) => k === source.kind) ||
      !knowledgeOrigins.some((o) => o === source.origin) ||
      source.synthetic !== (source.origin === 'synthetic')
    )
      return false;
    sourceIds.add(source.chunkId);
  }
  return (
    result.steps.length > 0 &&
    result.steps.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const step = item as { text?: unknown; sourceSectionIds?: unknown };
      return (
        typeof step.text === 'string' &&
        !!step.text.trim() &&
        Array.isArray(step.sourceSectionIds) &&
        step.sourceSectionIds.length > 0 &&
        step.sourceSectionIds.every((id) => typeof id === 'string' && sourceIds.has(id))
      );
    }) &&
    result.missingInformation.every((item) => typeof item === 'string')
  );
}

@Service()
export class AssistantApi {
  private readonly functions = inject(FIREBASE).functions;
  async prepareReplenishment(input: PrepareInput): Promise<ProposalResult> {
    try {
      const response = await httpsCallable<PrepareInput, unknown>(
        this.functions,
        'prepareReplenishment',
      )(input);
      if (!isReplenishmentProposal(response.data))
        throw new AssistantApiError('INVALID_MODEL_OUTPUT');
      return response.data;
    } catch (error) {
      throw this.controlledError(error);
    }
  }
  async answerProcedureQuestion(input: ProcedureInput): Promise<ProcedureResult> {
    try {
      const callable = httpsCallable<ProcedureInput, unknown>(
        this.functions,
        'answerProcedureQuestion',
      );
      const response = await callable(input);
      if (!isProcedureResult(response.data)) throw new AssistantApiError('INVALID_MODEL_OUTPUT');
      return response.data;
    } catch (error) {
      throw this.controlledError(error);
    }
  }
  private controlledError(error: unknown): AssistantApiError {
    if (error instanceof AssistantApiError) return error;
    const detail =
      error &&
      typeof error === 'object' &&
      'details' in error &&
      error.details &&
      typeof error.details === 'object' &&
      'code' in error.details
        ? String(error.details.code)
        : '';
    if (Object.hasOwn(messages, detail)) return new AssistantApiError(detail as AssistantErrorCode);
    const firebaseCode =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const fallback: Record<string, AssistantErrorCode> = {
      'functions/unauthenticated': 'UNAUTHENTICATED',
      'functions/permission-denied': 'FORBIDDEN',
      'functions/invalid-argument': 'VALIDATION_ERROR',
      'functions/resource-exhausted': 'RATE_LIMITED',
      'functions/deadline-exceeded': 'TIMEOUT',
      'functions/aborted': 'SOURCE_CHANGED',
    };
    return new AssistantApiError(fallback[firebaseCode] ?? 'SERVICE_UNAVAILABLE');
  }
}
