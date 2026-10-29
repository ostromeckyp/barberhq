import type { VersionStatus } from '../../../../../../shared/contracts/knowledge';

export const MAX_KNOWLEDGE_PDF_BYTES = 10 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

export type KnowledgeApiErrorCode =
  | 'IN_PROGRESS'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PRODUCT_REVIEW_REQUIRED'
  | 'REVIEW_INCOMPLETE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'STALE_STATE'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'QUEUE_UNAVAILABLE'
  | 'OUTCOME_UNKNOWN'
  | 'UPLOAD_TOO_LARGE'
  | 'INVALID_PDF'
  | 'UPLOAD_FAILED';

export class KnowledgeApiError extends Error {
  constructor(readonly code: KnowledgeApiErrorCode) {
    super(code);
    this.name = 'KnowledgeApiError';
  }
}

const codes: Record<string, KnowledgeApiErrorCode> = {
  unauthenticated: 'UNAUTHENTICATED',
  'permission-denied': 'FORBIDDEN',
  forbidden: 'FORBIDDEN',
  'invalid-argument': 'VALIDATION_ERROR',
  validation_error: 'VALIDATION_ERROR',
  stale_state: 'STALE_STATE',
  version_conflict: 'VERSION_CONFLICT',
  idempotency_conflict: 'IDEMPOTENCY_CONFLICT',
  queue_unavailable: 'QUEUE_UNAVAILABLE',
  outcome_unknown: 'OUTCOME_UNKNOWN',
  upload_too_large: 'UPLOAD_TOO_LARGE',
  too_large: 'UPLOAD_TOO_LARGE',
  invalid_pdf: 'INVALID_PDF',
  app_check_required: 'UNAUTHENTICATED',
  upload_unavailable: 'OUTCOME_UNKNOWN',
  in_progress: 'IN_PROGRESS',
  timeout: 'TIMEOUT',
  rate_limited: 'RATE_LIMITED',
  provider_unavailable: 'PROVIDER_UNAVAILABLE',
  product_review_required: 'PRODUCT_REVIEW_REQUIRED',
  review_incomplete: 'REVIEW_INCOMPLETE',
  'failed-precondition': 'VERSION_CONFLICT',
};

export function mapKnowledgeError(error: unknown): KnowledgeApiError {
  const details = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const nested =
    details['details'] && typeof details['details'] === 'object'
      ? (details['details'] as Record<string, unknown>)['code']
      : undefined;
  const raw = [
    details['code'],
    nested,
    details['message'],
    error instanceof Error ? error.message : String(error),
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ');
  const normalized = raw
    .toLowerCase()
    .replace(/^functions\//, '')
    .replaceAll('-', '_');
  const match = Object.keys(codes).find((code) => normalized.includes(code.replaceAll('-', '_')));
  return new KnowledgeApiError(match ? codes[match]! : 'UPLOAD_FAILED');
}

export async function hashPdf(file: File): Promise<string> {
  if (
    file.size < 5 ||
    file.size > MAX_KNOWLEDGE_PDF_BYTES ||
    (file.type && file.type !== 'application/pdf')
  ) {
    throw new KnowledgeApiError(
      file.size > MAX_KNOWLEDGE_PDF_BYTES ? 'UPLOAD_TOO_LARGE' : 'INVALID_PDF',
    );
  }
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== '%PDF-') throw new KnowledgeApiError('INVALID_PDF');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadKnowledgePdf(options: {
  url: string;
  versionId: string;
  file: File;
  authToken: string;
  appCheckToken: string | null;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<VersionStatus> {
  const { file, signal } = options;
  if (signal?.aborted) throw new DOMException('The upload was aborted.', 'AbortError');
  if (file.size < 5 || file.size > MAX_KNOWLEDGE_PDF_BYTES) {
    throw new KnowledgeApiError(
      file.size > MAX_KNOWLEDGE_PDF_BYTES ? 'UPLOAD_TOO_LARGE' : 'INVALID_PDF',
    );
  }
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== '%PDF-') throw new KnowledgeApiError('INVALID_PDF');
  if (signal?.aborted) throw new DOMException('The upload was aborted.', 'AbortError');
  const url = new URL(options.url);
  url.search = '';
  url.hash = '';
  url.searchParams.set('versionId', options.versionId);
  const headers = new Headers({
    Authorization: `Bearer ${options.authToken}`,
    'Content-Type': 'application/pdf',
  });
  if (options.appCheckToken) headers.set('X-Firebase-AppCheck', options.appCheckToken);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'POST',
      headers,
      body: file,
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new DOMException('The upload was aborted.', 'AbortError');
    throw mapKnowledgeError(error);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new KnowledgeApiError('UPLOAD_FAILED');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new KnowledgeApiError('UPLOAD_FAILED');
    }
    chunks.push(value);
  }
  const payloadBytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    payloadBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    throw new KnowledgeApiError('UPLOAD_FAILED');
  }
  if (!response.ok) {
    const record =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    throw mapKnowledgeError(record['error'] ?? record['code'] ?? `HTTP ${response.status}`);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('versionId' in payload) ||
    !('status' in payload)
  ) {
    throw new KnowledgeApiError('UPLOAD_FAILED');
  }
  return payload as VersionStatus;
}
