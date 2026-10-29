import { initializeApp } from 'firebase-admin/app';
import { createAnswerProcedureQuestionFunction } from './ai/procedure.js';
import { createPrepareReplenishmentFunction } from './ai/replenishment.js';
import { createRemoveSalonShorthandFunction } from './ai/salon-alias-callables.js';
import { stockCommand } from './stock/commands.js';
import { deliveryCommand, deliveryProceduresFunction } from './delivery/commands.js';
import { setGlobalOptions } from 'firebase-functions';
import { sourcePdfFunction } from './knowledge/source.js';
import { uploadKnowledgePdfFunction } from './knowledge/upload.js';
import {
  createDocumentUploadFunction,
  deleteKnowledgeVersionFunction,
  retryDocumentProcessingFunction,
  reviewAndPublishDocumentFunction,
} from './knowledge/callables.js';
import {
  saveKnowledgeProductReviewFunction,
  acceptKnowledgeProductReviewFunction,
  suggestKnowledgeProductLinkFunction,
  generateKnowledgeProductAliasesFunction,
} from './knowledge/product-knowledge-callables.js';
import { processKnowledgeTaskFunction } from './knowledge/worker.js';
import {
  attachProductCardFunction,
  createProductFunction,
  getProductCardAttachmentFunction,
  processProductCardFunction,
  getProductAdminFunction,
  listProductAliasesFunction,
  saveProductAliasesFunction,
  setHqStockFunction,
  updateProductFunction,
} from './products/callables.js';

initializeApp();

setGlobalOptions({
  serviceAccount: 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com',
});

export const submitRequest = stockCommand('SUBMIT');
export const approveRequest = stockCommand('APPROVE');
export const rejectRequest = stockCommand('REJECT');
export const dispatchTransfer = stockCommand('DISPATCH');
export const receiveTransfer = stockCommand('RECEIVE');
export const recordDeliveryReceipt = deliveryCommand('RECORD_RECEIPT');
export const startDeliveryIssueReview = deliveryCommand('START_REVIEW');
export const addDeliveryIssueNote = deliveryCommand('ADD_NOTE');
export const createDeliveryReplacement = deliveryCommand('CREATE_REPLACEMENT');
export const setDeliveryProcedure = deliveryCommand('SET_PROCEDURE');
export const getDeliveryProcedures = deliveryProceduresFunction();
export const getSourcePdf = sourcePdfFunction();
export const createDocumentUpload = createDocumentUploadFunction();
export const reviewAndPublishDocument = reviewAndPublishDocumentFunction();
export const retryDocumentProcessing = retryDocumentProcessingFunction();
export const deleteKnowledgeVersion = deleteKnowledgeVersionFunction();
export const uploadKnowledgePdf = uploadKnowledgePdfFunction();
export const processKnowledgeTask = processKnowledgeTaskFunction();
export const answerProcedureQuestion = createAnswerProcedureQuestionFunction();
export const prepareReplenishment = createPrepareReplenishmentFunction();
export const removeSalonShorthand = createRemoveSalonShorthandFunction();

export const saveKnowledgeProductReview = saveKnowledgeProductReviewFunction();

export const suggestKnowledgeProductLink = suggestKnowledgeProductLinkFunction();
export const generateKnowledgeProductAliases = generateKnowledgeProductAliasesFunction();

export const acceptKnowledgeProductReview = acceptKnowledgeProductReviewFunction();

export const getProductAdmin = getProductAdminFunction();
export const createProduct = createProductFunction();
export const updateProduct = updateProductFunction();
export const setHqStock = setHqStockFunction();
export const listProductAliases = listProductAliasesFunction();
export const saveProductAliases = saveProductAliasesFunction();
export const attachProductCard = attachProductCardFunction();
export const processProductCard = processProductCardFunction();
export const getProductCardAttachment = getProductCardAttachmentFunction();
