import type {
  KnowledgeProductWorkspace,
  KnowledgeProductReview,
  SaveKnowledgeProductReviewInput,
  AcceptKnowledgeProductReviewInput,
  GenerateKnowledgeProductAliasesInput,
  SuggestKnowledgeProductLinkInput,
} from '../../../../../../shared/contracts/product-knowledge';
import { mapProductKnowledgeWorkspace } from './product-knowledge.mapper';
import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { getIdToken } from 'firebase/auth';
import { getToken as getAppCheckToken } from 'firebase/app-check';
import type { Page, PageInput } from '../../../../../../shared/contracts/business';
import type {
  CreateDocumentRequest,
  DeleteVersionInput,
  DocumentRow,
  KnowledgeReview,
  RetryDocumentInput,
  ReviewDocumentInput,
  VersionStatus,
} from '../../../../../../shared/contracts/knowledge';
import * as sdk from '../../../core/generated';
import { FIREBASE } from '../../../core/firebase.providers';
import { SalonContext } from '../../../core/salon-context';
import { runtimeConfig } from '../../../core/public-config';
import type { PublicConfig } from '../../../../../../scripts/config/public-config';
import {
  mapDocumentRow,
  mapKnowledgeReview,
  type KnowledgePageRecord,
  type KnowledgeVersionRecord,
} from './knowledge.mapper';
import {
  hashPdf,
  KnowledgeApiError,
  mapKnowledgeError,
  uploadKnowledgePdf,
} from './knowledge-http';

const PAGE_SIZE = 50;
const queryPolicy = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };

export function shouldLoadHqDocumentRows(
  role: string,
  workspace: { kind: 'HQ' } | { kind: 'SALON'; salonId: string } | undefined,
): boolean {
  return role === sdk.MemberRole.HQ && workspace?.kind === 'HQ';
}

export function normalizePage(page: Partial<PageInput> = {}): PageInput {
  const limit = page.limit ?? PAGE_SIZE;
  const offset = page.offset ?? 0;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > PAGE_SIZE ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new RangeError('Document page must use a limit from 1 to 50 and a nonnegative offset.');
  }
  return { limit, offset };
}

@Service()
export class KnowledgeDocumentsApi {
  private readonly firebase = inject(FIREBASE);
  private readonly salonContext = inject(SalonContext);

  async listDocuments(
    input: PageInput = { limit: PAGE_SIZE, offset: 0 },
  ): Promise<Page<DocumentRow>> {
    const page = normalizePage(input);
    const member = (await sdk.getMyMembership(this.firebase.data, queryPolicy)).data.membership;
    if (!member) throw new KnowledgeApiError('FORBIDDEN');
    const vars = { limit: page.limit + 1, offset: page.offset };
    const workspace = this.salonContext.workspace();
    const rows = shouldLoadHqDocumentRows(member.role, workspace)
      ? ((await sdk.listHqKnowledgeDocuments(this.firebase.data, vars, queryPolicy)).data.membership
          ?.business.versions ?? [])
      : ((await sdk.listPublishedKnowledgeDocuments(this.firebase.data, vars, queryPolicy)).data
          .membership?.business.versions ?? []);
    const hasMore = rows.length > page.limit;
    const items = rows
      .slice(0, page.limit)
      .map((row) => mapDocumentRow(row as KnowledgeVersionRecord));
    return { items, nextOffset: hasMore ? page.offset + items.length : null };
  }

  async getReview(versionId: string): Promise<KnowledgeReview> {
    const result = await sdk.getKnowledgeReview(this.firebase.data, { versionId }, queryPolicy);
    const row = result.data.membership?.business.versions[0];
    if (!row || row.id !== versionId) throw new KnowledgeApiError('FORBIDDEN');
    return mapKnowledgeReview(
      row as KnowledgeVersionRecord,
      row.extractionHash ?? null,
      row.pages as KnowledgePageRecord[],
    );
  }

  async getProductKnowledge(versionId: string): Promise<KnowledgeProductWorkspace> {
    const result = await sdk.getKnowledgeProductReview(
      this.firebase.data,
      { versionId },
      queryPolicy,
    );
    return mapProductKnowledgeWorkspace(result.data, versionId);
  }
  async saveKnowledgeProductReview(
    input: SaveKnowledgeProductReviewInput,
  ): Promise<KnowledgeProductReview> {
    return this.call<SaveKnowledgeProductReviewInput, KnowledgeProductReview>(
      'saveKnowledgeProductReview',
      input,
    );
  }
  async acceptKnowledgeProductReview(
    input: AcceptKnowledgeProductReviewInput,
  ): Promise<KnowledgeProductReview> {
    return this.call<AcceptKnowledgeProductReviewInput, KnowledgeProductReview>(
      'acceptKnowledgeProductReview',
      input,
    );
  }
  async generateKnowledgeProductAliases(
    input: GenerateKnowledgeProductAliasesInput,
  ): Promise<KnowledgeProductReview> {
    return this.call<GenerateKnowledgeProductAliasesInput, KnowledgeProductReview>(
      'generateKnowledgeProductAliases',
      input,
    );
  }
  async suggestKnowledgeProductLink(
    input: SuggestKnowledgeProductLinkInput,
  ): Promise<KnowledgeProductReview> {
    return this.call<SuggestKnowledgeProductLinkInput, KnowledgeProductReview>(
      'suggestKnowledgeProductLink',
      input,
    );
  }

  async createDocumentUpload(input: CreateDocumentRequest): Promise<VersionStatus> {
    return this.call<CreateDocumentRequest>('createDocumentUpload', input);
  }

  async reviewAndPublishDocument(input: ReviewDocumentInput): Promise<VersionStatus> {
    return this.call<ReviewDocumentInput>('reviewAndPublishDocument', input);
  }

  async retryDocumentProcessing(input: RetryDocumentInput): Promise<VersionStatus> {
    return this.call<RetryDocumentInput>('retryDocumentProcessing', input);
  }

  async deleteKnowledgeVersion(input: DeleteVersionInput): Promise<VersionStatus> {
    return this.call<DeleteVersionInput>('deleteKnowledgeVersion', input);
  }

  hashPdf(file: File): Promise<string> {
    return hashPdf(file);
  }

  async uploadPdf(versionId: string, file: File, signal?: AbortSignal): Promise<VersionStatus> {
    const config: PublicConfig | null = runtimeConfig.publicConfig;
    const user = this.firebase.auth.currentUser;
    if (!config || !user) throw new KnowledgeApiError('UNAUTHENTICATED');
    const endpoint = this.uploadEndpoint(config);
    const authToken = await getIdToken(user);
    const appCheckToken = runtimeConfig.useEmulators
      ? null
      : this.firebase.appCheck
        ? (await getAppCheckToken(this.firebase.appCheck)).token
        : (() => {
            throw new KnowledgeApiError('UNAUTHENTICATED');
          })();
    return uploadKnowledgePdf({ url: endpoint, versionId, file, authToken, appCheckToken, signal });
  }

  private async call<Input, Output = VersionStatus>(name: string, input: Input): Promise<Output> {
    try {
      return (await httpsCallable<Input, Output>(this.firebase.functions, name)(input)).data;
    } catch (error) {
      throw mapKnowledgeError(error);
    }
  }

  private uploadEndpoint(config: PublicConfig): string {
    if (config.pdfUploadUrl) return config.pdfUploadUrl;
    return runtimeConfig.useEmulators
      ? `http://127.0.0.1:5001/${config.projectId}/${config.functionsRegion}/uploadKnowledgePdf`
      : `https://${config.functionsRegion}-${config.projectId}.cloudfunctions.net/uploadKnowledgePdf`;
  }
}
