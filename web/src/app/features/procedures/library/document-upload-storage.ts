import type { CreateDocumentRequest } from '../../../../../../shared/contracts/knowledge/index';
import type { UploadDialogData } from '../models/upload-dialog-data';

/** Session storage for unresolved document registrations and staged uploads. */
export function isRecoverableForTarget(raw: string, data: UploadDialogData): boolean {
  try {
    const value = JSON.parse(raw) as CreateDocumentRequest;
    return isValidRegistration(value) && matchesUploadTarget(value, data);
  } catch {
    return false;
  }
}
export function isValidRegistration(value: CreateDocumentRequest): boolean {
  return (
    typeof value.idempotencyKey === 'string' &&
    typeof value.sha256 === 'string' &&
    Array.isArray(value.sourceUrls)
  );
}
export function matchesUploadTarget(value: CreateDocumentRequest, data: UploadDialogData): boolean {
  if (data.resume) return false;
  if (data.replaceTarget) return value.documentId === data.replaceTarget.documentId;
  return value.documentId === undefined;
}
export function uploadTargetStorageKey(storagePrefix: string, data: UploadDialogData): string {
  if (data.resume) return `${storagePrefix}:resume:${encodeURIComponent(data.resume.versionId)}`;
  if (data.replaceTarget)
    return `${storagePrefix}:replace:${encodeURIComponent(data.replaceTarget.documentId)}`;
  return `${storagePrefix}:new`;
}
export function persistPendingRegistration(
  storageKey: string,
  frozen: CreateDocumentRequest | undefined,
): void {
  try {
    if (frozen && storageKey) sessionStorage.setItem(storageKey, JSON.stringify(frozen));
  } catch {
    /* In-memory replay remains available in this dialog. */
  }
}
export function removePendingRegistration(storageKey: string): void {
  try {
    if (storageKey) sessionStorage.removeItem(storageKey);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
export function persistPendingUpload(storageKey: string, versionId: string, sha256: string): void {
  try {
    if (storageKey)
      sessionStorage.setItem(`${storageKey}:staged`, JSON.stringify({ versionId, sha256 }));
  } catch {
    /* The server list remains the durable record. */
  }
}
export function clearPendingUpload(storageKey: string): void {
  try {
    if (storageKey) sessionStorage.removeItem(`${storageKey}:staged`);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
export function clearScopeStorage(storageKey: string): void {
  try {
    const prefix = storageKey;
    if (!prefix) return;
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key === prefix || key?.startsWith(`${prefix}:`)) sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
