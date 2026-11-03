import { onCall } from 'firebase-functions/v2/https';
import type { AiOp } from '../../../shared/contracts/functions/index.js';
import { createAnswerProcedureQuestionFunction } from '../ai/procedure.js';
import { createPrepareReplenishmentFunction } from '../ai/replenishment.js';
import { createTranscribeOrderFunction } from '../ai/transcription.js';
import {
  generateKnowledgeProductAliasesFunction,
  suggestKnowledgeProductLinkFunction,
} from '../product-knowledge/callables.js';
import { processProductCardFunction } from '../products/callables.js';
import { createRouter } from './router.js';

export const aiHandlers = {
  prepareReplenishment: createPrepareReplenishmentFunction(),
  answerProcedureQuestion: createAnswerProcedureQuestionFunction(),
  suggestKnowledgeProductLink: suggestKnowledgeProductLinkFunction(),
  generateKnowledgeProductAliases: generateKnowledgeProductAliasesFunction(),
  processProductCard: processProductCardFunction(),
  transcribeOrder: createTranscribeOrderFunction(),
} satisfies Record<AiOp, unknown>;

export const ai = onCall(
  {
    region: 'europe-west1',
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    maxInstances: 5,
  },
  createRouter(aiHandlers),
);
