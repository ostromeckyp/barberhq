import { callable, createReviewService } from '../knowledge/callables.js';
import { DocumentCommandService } from '../knowledge/document-commands.js';
import {
  createProductKnowledgeCommands,
  createProductKnowledgeGeneration,
} from '../knowledge/product-knowledge-callables.js';
import { createProductCardService } from './card-attachment.js';
import { KnowledgeError, KnowledgeRepository } from '../knowledge/repository.js';
import {
  knowledgeBucket,
  knowledgeDataConnectors,
  knowledgeRuntimeConfig,
} from '../knowledge/runtime.js';
import { createProductAdminCommands } from './commands.js';
import { createProductAliasCommands } from './aliases.js';

/** HQ-only product administration; scope is derived from the caller's membership in SQL. */
function commands() {
  return createProductAdminCommands(knowledgeDataConnectors(knowledgeRuntimeConfig()).server);
}
export const createProductFunction = () =>
  callable<unknown, unknown>((uid, data) => commands().create(uid, data));
export const updateProductFunction = () =>
  callable<unknown, unknown>((uid, data) => commands().update(uid, data));
export const setHqStockFunction = () =>
  callable<unknown, unknown>((uid, data) => commands().setHqStock(uid, data));
export const getProductAdminFunction = () =>
  callable<{ productId?: unknown }, unknown>((uid, data) => {
    if (typeof data.productId !== 'string' || !data.productId || data.productId.length > 200)
      throw new KnowledgeError('VALIDATION_ERROR');
    return commands().read(uid, data.productId);
  });
const aliasCommands = () =>
  createProductAliasCommands(knowledgeDataConnectors(knowledgeRuntimeConfig()).server);
export const listProductAliasesFunction = () =>
  callable<{ productId?: unknown }, unknown>((uid, data) => {
    if (typeof data.productId !== 'string' || !data.productId || data.productId.length > 200)
      throw new KnowledgeError('VALIDATION_ERROR');
    return aliasCommands().list(uid, data.productId);
  });
export const saveProductAliasesFunction = () =>
  callable<unknown, unknown>((uid, data) => aliasCommands().save(uid, data));
/** Card services; publication needs the review service, which authorizes HQ for that version. */
async function cardService(uid: string, versionId?: string) {
  const config = knowledgeRuntimeConfig();
  const connectors = knowledgeDataConnectors(config);
  const repo = new KnowledgeRepository(
    connectors.server,
    connectors.vector,
    knowledgeBucket(config),
  );
  return createProductCardService({
    dc: connectors.server,
    repo,
    documents: new DocumentCommandService(repo),
    products: createProductKnowledgeCommands(),
    generation: createProductKnowledgeGeneration(),
    ...(versionId ? { review: await createReviewService(uid, versionId) } : {}),
  });
}
export const attachProductCardFunction = () =>
  callable<unknown, unknown>(async (uid, data) => (await cardService(uid)).attach(uid, data));
export const processProductCardFunction = () =>
  callable<{ versionId?: unknown }, unknown>(async (uid, data) => {
    if (typeof data.versionId !== 'string' || !data.versionId || data.versionId.length > 300)
      throw new KnowledgeError('VALIDATION_ERROR');
    return (await cardService(uid, data.versionId)).process(uid, data);
  });
export const getProductCardAttachmentFunction = () =>
  callable<{ productId?: unknown }, unknown>(async (uid, data) => {
    if (typeof data.productId !== 'string' || !data.productId || data.productId.length > 200)
      throw new KnowledgeError('VALIDATION_ERROR');
    return (await cardService(uid)).state(uid, data.productId);
  });
