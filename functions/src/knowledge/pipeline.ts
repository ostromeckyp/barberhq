import type { ProcessingResult } from '../../../shared/contracts/knowledge/index.js';
import { KnowledgeError, KnowledgeRepository } from './repository.js';
import { stageVersion } from './pipeline-stage.js';
import { extractClaimedVersion, extractVersion } from './pipeline-extract.js';
import { recordOperatorProductReview, recordReview } from './pipeline-review.js';
import { publishVersion } from './pipeline-publish.js';
import type { ManifestEntry } from './models/manifest-entry.js';
import type { ReviewInput } from './models/review-input.js';
import type { ReviewActor } from './models/review-actor.js';
import type { PublishInput } from './models/publish-input.js';
import type { Embedder } from './models/embedder.js';

export { knowledgeIds } from './pipeline-scope.js';

/** Stage → extract → review → publish; each stage lives in its own pipeline-*.ts module. */
export class KnowledgePipeline {
  constructor(
    readonly repo: KnowledgeRepository,
    readonly embedder: Embedder,
    readonly businessId: string,
    readonly businessKey: string,
  ) {
    if (!businessId || !businessKey || embedder.config.dimension !== 768)
      throw new KnowledgeError('INVALID_CONFIG');
  }

  async stageVersion(input: ManifestEntry, bytes: Uint8Array): Promise<string> {
    return stageVersion(this, input, bytes);
  }

  async extractVersion(versionId: string): Promise<ProcessingResult> {
    return extractVersion(this, versionId);
  }

  /** Runs extraction only after the caller has atomically begun or claimed this revision. */
  async extractClaimedVersion(
    versionId: string,
    claim: { revision: number; leaseId: string | null },
  ): Promise<ProcessingResult> {
    return extractClaimedVersion(this, versionId, claim);
  }

  async recordReview(input: ReviewInput, actor: ReviewActor): Promise<void> {
    return recordReview(this, input, actor);
  }

  async publishVersion(input: PublishInput): Promise<ProcessingResult> {
    return publishVersion(this, input);
  }

  /**
   * Product review from an operator receipt (demo reset): a card links its whole first passage
   * to its product, a catalog acknowledges empty knowledge. Every other passage is acknowledged.
   */
  async recordOperatorProductReview(input: {
    versionId: string;
    productId: string | null;
  }): Promise<{ reviewedHash: string }> {
    return recordOperatorProductReview(this, input);
  }
}
