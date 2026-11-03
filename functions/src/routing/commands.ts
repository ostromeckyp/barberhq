import { onCall } from 'firebase-functions/v2/https';
import type { CommandOp } from '../../../shared/contracts/functions/index.js';
import { createRemoveSalonShorthandFunction } from '../ai/salon-alias-callables.js';
import { deliveryCommand, deliveryProceduresFunction } from '../delivery/commands.js';
import {
  createDocumentUploadFunction,
  deleteKnowledgeVersionFunction,
  retryDocumentProcessingFunction,
  reviewAndPublishDocumentFunction,
} from '../knowledge/callables.js';
import {
  acceptKnowledgeProductReviewFunction,
  saveKnowledgeProductReviewFunction,
} from '../product-knowledge/callables.js';
import {
  attachProductCardFunction,
  createProductFunction,
  getProductAdminFunction,
  getProductCardAttachmentFunction,
  listProductAliasesFunction,
  saveProductAliasesFunction,
  setHqStockFunction,
  updateProductFunction,
} from '../products/callables.js';
import { registerPushTokenFunction, unregisterPushTokenFunction } from '../push/callables.js';
import { stockCommand } from '../stock/commands.js';
import { createRouter } from './router.js';

export const commandHandlers = {
  submitRequest: stockCommand('SUBMIT'),
  approveRequest: stockCommand('APPROVE'),
  rejectRequest: stockCommand('REJECT'),
  dispatchTransfer: stockCommand('DISPATCH'),
  receiveTransfer: stockCommand('RECEIVE'),
  recordDeliveryReceipt: deliveryCommand('RECORD_RECEIPT'),
  startDeliveryIssueReview: deliveryCommand('START_REVIEW'),
  addDeliveryIssueNote: deliveryCommand('ADD_NOTE'),
  createDeliveryReplacement: deliveryCommand('CREATE_REPLACEMENT'),
  setDeliveryProcedure: deliveryCommand('SET_PROCEDURE'),
  getDeliveryProcedures: deliveryProceduresFunction(),
  removeSalonShorthand: createRemoveSalonShorthandFunction(),
  getProductAdmin: getProductAdminFunction(),
  createProduct: createProductFunction(),
  updateProduct: updateProductFunction(),
  setHqStock: setHqStockFunction(),
  listProductAliases: listProductAliasesFunction(),
  saveProductAliases: saveProductAliasesFunction(),
  attachProductCard: attachProductCardFunction(),
  getProductCardAttachment: getProductCardAttachmentFunction(),
  createDocumentUpload: createDocumentUploadFunction(),
  reviewAndPublishDocument: reviewAndPublishDocumentFunction(),
  retryDocumentProcessing: retryDocumentProcessingFunction(),
  deleteKnowledgeVersion: deleteKnowledgeVersionFunction(),
  saveKnowledgeProductReview: saveKnowledgeProductReviewFunction(),
  acceptKnowledgeProductReview: acceptKnowledgeProductReviewFunction(),
  registerPushToken: registerPushTokenFunction(),
  unregisterPushToken: unregisterPushTokenFunction(),
} satisfies Record<CommandOp, unknown>;

export const commands = onCall(
  {
    region: 'europe-west1',
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    maxInstances: 5,
  },
  createRouter(commandHandlers, { service: 'commands' }),
);
