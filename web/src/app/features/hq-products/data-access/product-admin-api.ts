import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE } from '../../../core/firebase.providers';
import { KnowledgeDocumentsApi } from '../../procedures/data-access/knowledge-documents-api';
import type {
  CreateProductInput,
  HqStock,
  ProductAliasesResult,
  ProductDetail,
  SaveProductAliasesInput,
  SetHqStockInput,
  UpdateProductInput,
} from '../../../../../../shared/contracts/product-admin';

export type CardSuggestion = {
  phrase: string;
  kind: 'NAME' | 'PHONETIC' | 'TYPE';
  collisions: string[];
};
export type CardAttachmentState = {
  documentId: string;
  versionId: string;
  status: 'UPLOADING' | 'GENERATING' | 'PUBLISHING' | 'PUBLISHED' | 'NEEDS_REVIEW' | 'FAILED';
  suggestions: CardSuggestion[];
};
export type ProductAdminErrorCode =
  | 'STALE_STATE'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'UNKNOWN';
export class ProductAdminError extends Error {
  constructor(readonly code: ProductAdminErrorCode) {
    super(code);
  }
}
const known: ProductAdminErrorCode[] = [
  'STALE_STATE',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'IN_PROGRESS',
  'RATE_LIMITED',
];

/** HQ product screen calls; every write is a server callable with derived business scope. */
@Service()
export class ProductAdminApi {
  private readonly firebase = inject(FIREBASE);
  private readonly documents = inject(KnowledgeDocumentsApi);
  private async call<I, O>(name: string, input: I): Promise<O> {
    try {
      return (await httpsCallable<I, O>(this.firebase.functions, name)(input)).data;
    } catch (error) {
      const details = (error as { details?: { code?: string } })?.details?.code;
      const code = known.find((c) => c === details) ?? 'UNKNOWN';
      throw new ProductAdminError(code);
    }
  }
  read(productId: string) {
    return this.call<{ productId: string }, ProductDetail>('getProductAdmin', { productId });
  }
  create(input: CreateProductInput) {
    return this.call<CreateProductInput, ProductDetail>('createProduct', input);
  }
  update(input: UpdateProductInput) {
    return this.call<UpdateProductInput, ProductDetail>('updateProduct', input);
  }
  setHqStock(input: SetHqStockInput) {
    return this.call<SetHqStockInput, HqStock>('setHqStock', input);
  }
  listAliases(productId: string) {
    return this.call<{ productId: string }, ProductAliasesResult>('listProductAliases', {
      productId,
    });
  }
  saveAliases(input: SaveProductAliasesInput) {
    return this.call<SaveProductAliasesInput, ProductAliasesResult>('saveProductAliases', input);
  }
  cardState(productId: string) {
    return this.call<{ productId: string }, CardAttachmentState>('getProductCardAttachment', {
      productId,
    });
  }
  async attachCard(
    productId: string,
    file: File,
    idempotencyKey: string,
  ): Promise<CardAttachmentState> {
    const sha256 = await this.documents.hashPdf(file);
    const state = await this.call<object, CardAttachmentState>('attachProductCard', {
      productId,
      sha256,
      idempotencyKey,
    });
    await this.documents.uploadPdf(state.versionId, file);
    return state;
  }
  processCard(productId: string, versionId: string, idempotencyKey: string) {
    return this.call<object, CardAttachmentState>('processProductCard', {
      productId,
      versionId,
      idempotencyKey,
    });
  }
}
