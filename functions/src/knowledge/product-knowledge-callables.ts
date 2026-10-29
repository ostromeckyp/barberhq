import { HttpsError } from 'firebase-functions/v2/https';
import { AiError } from '../ai/budget.js';
import { createAiAdmission } from '../ai/admission.js';
import { createSqlAiRepository } from '../ai/repository.js';
import { createProductKnowledgeGenerator } from './product-knowledge-model.js';
import { ProductKnowledgeGeneration } from './product-knowledge-generation.js';
import { callable } from './callables.js';
import { ProductKnowledgeCommands } from './product-knowledge-commands.js';
import { knowledgeDataConnectors, knowledgeRuntimeConfig } from './runtime.js';
export function createProductKnowledgeCommands() {
  return new ProductKnowledgeCommands({
    dc: knowledgeDataConnectors(knowledgeRuntimeConfig()).server,
  });
}
export function saveKnowledgeProductReviewFunction() {
  return callable<unknown, unknown>((uid, data) =>
    createProductKnowledgeCommands().save(uid, data as never),
  );
}

export function createProductKnowledgeGeneration() {
  const commands = createProductKnowledgeCommands();
  return new ProductKnowledgeGeneration(
    commands,
    createAiAdmission(createSqlAiRepository(commands.products.dc)),
    createProductKnowledgeGenerator(),
  );
}
function generationCallable(kind: 'link' | 'aliases') {
  return callable<unknown, unknown>(async (uid, data) => {
    try {
      return await (kind === 'link'
        ? createProductKnowledgeGeneration().suggestLink(uid, data as never)
        : createProductKnowledgeGeneration().generateAliases(uid, data as never));
    } catch (error) {
      if (error instanceof AiError)
        throw new HttpsError(
          error.code === 'RATE_LIMITED'
            ? 'resource-exhausted'
            : error.code === 'FORBIDDEN'
              ? 'permission-denied'
              : error.code === 'VALIDATION_ERROR'
                ? 'invalid-argument'
                : 'unavailable',
          error.code,
          { code: error.code },
        );
      throw error;
    }
  });
}
export function suggestKnowledgeProductLinkFunction() {
  return generationCallable('link');
}
export function generateKnowledgeProductAliasesFunction() {
  return generationCallable('aliases');
}

export function acceptKnowledgeProductReviewFunction() {
  return callable<unknown, unknown>((uid, data) =>
    createProductKnowledgeCommands().accept(uid, data as never),
  );
}
