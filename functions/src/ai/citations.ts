import type { CitedStep } from '../../../shared/contracts/ai/index.js';
import type { SourceSection } from '../../../shared/contracts/knowledge/index.js';
import { AiError } from './budget.js';
import type { RetrievedChunk } from './retrieval.js';

/** Only database rows can create a public source; model fields are never read here. */
export function validateCitations(
  steps: CitedStep[],
  retrieved: RetrievedChunk[],
): SourceSection[] {
  if (
    !Array.isArray(steps) ||
    steps.length === 0 ||
    !Array.isArray(retrieved) ||
    retrieved.length > 3
  ) {
    throw new AiError('INVALID_MODEL_OUTPUT');
  }
  const byId = new Map<string, RetrievedChunk>();
  for (const row of retrieved) {
    if (!row || !row.chunkId || row.sourceSectionId !== row.chunkId || byId.has(row.chunkId)) {
      throw new AiError('INVALID_MODEL_OUTPUT');
    }
    byId.set(row.chunkId, row);
  }
  const cited = new Set<string>();
  for (const step of steps) {
    if (
      !step ||
      typeof step.text !== 'string' ||
      !step.text.trim() ||
      !Array.isArray(step.sourceSectionIds) ||
      step.sourceSectionIds.length === 0
    ) {
      throw new AiError('INVALID_MODEL_OUTPUT');
    }
    for (const id of step.sourceSectionIds) {
      if (typeof id !== 'string' || !byId.has(id)) throw new AiError('INVALID_MODEL_OUTPUT');
      cited.add(id);
    }
  }
  return [...cited].map((id) => {
    const {
      cosineDistance: _distance,
      documentRevision: _revision,
      embeddingConfigHash: _hash,
      ...source
    } = byId.get(id)!;
    return source;
  });
}
