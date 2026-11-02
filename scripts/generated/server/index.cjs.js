const { validateAdminArgs } = require('firebase-admin/data-connect');

const DeliveryCommandType = {
  RECORD_RECEIPT: "RECORD_RECEIPT",
  START_REVIEW: "START_REVIEW",
  CREATE_REPLACEMENT: "CREATE_REPLACEMENT",
  ADD_NOTE: "ADD_NOTE",
  SET_PROCEDURE: "SET_PROCEDURE",
}
exports.DeliveryCommandType = DeliveryCommandType;

const DeliveryIssueEventType = {
  OPENED: "OPENED",
  REVIEW_STARTED: "REVIEW_STARTED",
  NOTE_ADDED: "NOTE_ADDED",
  REPLACEMENT_CREATED: "REPLACEMENT_CREATED",
  REPLACEMENT_REJECTED: "REPLACEMENT_REJECTED",
  REPLACEMENT_RECEIVED: "REPLACEMENT_RECEIVED",
}
exports.DeliveryIssueEventType = DeliveryIssueEventType;

const DeliveryIssueStatus = {
  OPEN: "OPEN",
  IN_REVIEW: "IN_REVIEW",
  REPLACEMENT_IN_PROGRESS: "REPLACEMENT_IN_PROGRESS",
  RESOLVED: "RESOLVED",
}
exports.DeliveryIssueStatus = DeliveryIssueStatus;

const DeliveryProblemKind = {
  DAMAGED: "DAMAGED",
  MISSING: "MISSING",
}
exports.DeliveryProblemKind = DeliveryProblemKind;

const KnowledgeDocumentKind = {
  PROCEDURE: "PROCEDURE",
  POLICY: "POLICY",
  PRODUCT_CARD: "PRODUCT_CARD",
  PRODUCT_CATALOG: "PRODUCT_CATALOG",
}
exports.KnowledgeDocumentKind = KnowledgeDocumentKind;

const KnowledgeOrigin = {
  OFFICIAL: "OFFICIAL",
  PUBLIC_COMPILATION: "PUBLIC_COMPILATION",
  SYNTHETIC: "SYNTHETIC",
}
exports.KnowledgeOrigin = KnowledgeOrigin;

const KnowledgePageQuality = {
  COMPLETE: "COMPLETE",
  NEEDS_REVIEW: "NEEDS_REVIEW",
}
exports.KnowledgePageQuality = KnowledgePageQuality;

const KnowledgePendingStage = {
  EXTRACT: "EXTRACT",
  PUBLISH: "PUBLISH",
}
exports.KnowledgePendingStage = KnowledgePendingStage;

const KnowledgeProcessingStatus = {
  STAGED: "STAGED",
  EXTRACTED: "EXTRACTED",
  REVIEWED: "REVIEWED",
  EMBEDDED: "EMBEDDED",
  READY: "READY",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FAILED: "FAILED",
}
exports.KnowledgeProcessingStatus = KnowledgeProcessingStatus;

const KnowledgePublicationStatus = {
  DEMO_CURRENT: "DEMO_CURRENT",
  RETIRED: "RETIRED",
}
exports.KnowledgePublicationStatus = KnowledgePublicationStatus;

const KnowledgeSourceType = {
  SYNTHETIC_PROCEDURE: "SYNTHETIC_PROCEDURE",
  PUBLIC_PRODUCT_SUMMARY: "PUBLIC_PRODUCT_SUMMARY",
}
exports.KnowledgeSourceType = KnowledgeSourceType;

const LocationKind = {
  HQ: "HQ",
  SALON: "SALON",
}
exports.LocationKind = LocationKind;

const MemberRole = {
  HQ: "HQ",
  SALON: "SALON",
}
exports.MemberRole = MemberRole;

const MovementType = {
  DISPATCH: "DISPATCH",
  RECEIPT: "RECEIPT",
}
exports.MovementType = MovementType;

const ProductAliasKind = {
  NAME: "NAME",
  TYPE: "TYPE",
  PHONETIC: "PHONETIC",
}
exports.ProductAliasKind = ProductAliasKind;

const ProductAliasSource = {
  GENERATED: "GENERATED",
  HQ: "HQ",
  SALON_CONFIRMED: "SALON_CONFIRMED",
  SEED: "SEED",
}
exports.ProductAliasSource = ProductAliasSource;

const ProductAliasStatus = {
  PROPOSED: "PROPOSED",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  RETIRED: "RETIRED",
}
exports.ProductAliasStatus = ProductAliasStatus;

const RequestState = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  RESERVED: "RESERVED",
  DISPATCHED: "DISPATCHED",
  RECEIVED: "RECEIVED",
  REJECTED: "REJECTED",
  RECEIVED_WITH_ISSUE: "RECEIVED_WITH_ISSUE",
}
exports.RequestState = RequestState;

const StockActionType = {
  SUBMIT: "SUBMIT",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  DISPATCH: "DISPATCH",
  RECEIVE: "RECEIVE",
}
exports.StockActionType = StockActionType;

const connectorConfig = {
  connector: 'server',
  serviceId: 'barberhq',
  location: 'europe-west1'
};
exports.connectorConfig = connectorConfig;

function readAiActor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadAiActor', inputVars, inputOpts);
}
exports.readAiActor = readAiActor;

function admitAiWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AdmitAiWindow', inputVars, inputOpts);
}
exports.admitAiWindow = admitAiWindow;

function readAiCurrentWindow(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadAiCurrentWindow', inputVars, inputOpts);
}
exports.readAiCurrentWindow = readAiCurrentWindow;

function changeDeliveryIssue(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ChangeDeliveryIssue', inputVars, inputOpts);
}
exports.changeDeliveryIssue = changeDeliveryIssue;

function createDeliveryReplacement(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateDeliveryReplacement', inputVars, inputOpts);
}
exports.createDeliveryReplacement = createDeliveryReplacement;

function insertLegacyDeliveryReceipt(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InsertLegacyDeliveryReceipt', inputVars, inputOpts);
}
exports.insertLegacyDeliveryReceipt = insertLegacyDeliveryReceipt;

function readDeliveryBindings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadDeliveryBindings', inputVars, inputOpts);
}
exports.readDeliveryBindings = readDeliveryBindings;

function readDeliveryProcedureDocument(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadDeliveryProcedureDocument', inputVars, inputOpts);
}
exports.readDeliveryProcedureDocument = readDeliveryProcedureDocument;

function setDeliveryProcedure(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetDeliveryProcedure', inputVars, inputOpts);
}
exports.setDeliveryProcedure = setDeliveryProcedure;

function readDeliveryContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadDeliveryContext', inputVars, inputOpts);
}
exports.readDeliveryContext = readDeliveryContext;

function readDeliveryKey(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadDeliveryKey', inputVars, inputOpts);
}
exports.readDeliveryKey = readDeliveryKey;

function readReplacementSlots(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadReplacementSlots', inputVars, inputOpts);
}
exports.readReplacementSlots = readReplacementSlots;

function readIssueContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadIssueContext', inputVars, inputOpts);
}
exports.readIssueContext = readIssueContext;

function recordDeliveryTransaction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordDeliveryTransaction', inputVars, inputOpts);
}
exports.recordDeliveryTransaction = recordDeliveryTransaction;

function knowledgeCursorDocuments(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeCursorDocuments', inputVars, inputOpts);
}
exports.knowledgeCursorDocuments = knowledgeCursorDocuments;

function knowledgeCursorBusiness(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeCursorBusiness', inputVars, inputOpts);
}
exports.knowledgeCursorBusiness = knowledgeCursorBusiness;

function knowledgeCursorLabels(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeCursorLabels', inputVars, inputOpts);
}
exports.knowledgeCursorLabels = knowledgeCursorLabels;

function backfillKnowledgeCursor(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BackfillKnowledgeCursor', inputVars, inputOpts);
}
exports.backfillKnowledgeCursor = backfillKnowledgeCursor;

function setKnowledgeDispatchFailure(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetKnowledgeDispatchFailure', inputVars, inputOpts);
}
exports.setKnowledgeDispatchFailure = setKnowledgeDispatchFailure;

function setKnowledgeDispatchPending(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetKnowledgeDispatchPending', inputVars, inputOpts);
}
exports.setKnowledgeDispatchPending = setKnowledgeDispatchPending;

function startKnowledgeRetry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartKnowledgeRetry', inputVars, inputOpts);
}
exports.startKnowledgeRetry = startKnowledgeRetry;

function completeKnowledgeRetry(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteKnowledgeRetry', inputVars, inputOpts);
}
exports.completeKnowledgeRetry = completeKnowledgeRetry;

function saveKnowledgeExtraction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveKnowledgeExtraction', inputVars, inputOpts);
}
exports.saveKnowledgeExtraction = saveKnowledgeExtraction;

function insertKnowledgePage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InsertKnowledgePage', inputVars, inputOpts);
}
exports.insertKnowledgePage = insertKnowledgePage;

function knowledgeMetadataPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeMetadataPage', inputVars, inputOpts);
}
exports.knowledgeMetadataPage = knowledgeMetadataPage;

function backfillKnowledgeMetadata(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BackfillKnowledgeMetadata', inputVars, inputOpts);
}
exports.backfillKnowledgeMetadata = backfillKnowledgeMetadata;

function setKnowledgePublishIntent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetKnowledgePublishIntent', inputVars, inputOpts);
}
exports.setKnowledgePublishIntent = setKnowledgePublishIntent;

function setOperatorKnowledgePublishIntent(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetOperatorKnowledgePublishIntent', inputVars, inputOpts);
}
exports.setOperatorKnowledgePublishIntent = setOperatorKnowledgePublishIntent;

function markKnowledgePublishStale(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkKnowledgePublishStale', inputVars, inputOpts);
}
exports.markKnowledgePublishStale = markKnowledgePublishStale;

function publishKnowledgeVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('PublishKnowledgeVersion', inputVars, inputOpts);
}
exports.publishKnowledgeVersion = publishKnowledgeVersion;

function registerKnowledgeVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RegisterKnowledgeVersion', inputVars, inputOpts);
}
exports.registerKnowledgeVersion = registerKnowledgeVersion;

function bindKnowledgeOriginal(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BindKnowledgeOriginal', inputVars, inputOpts);
}
exports.bindKnowledgeOriginal = bindKnowledgeOriginal;

function searchEligibleProcedureChunks(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('SearchEligibleProcedureChunks', inputVars, inputOpts);
}
exports.searchEligibleProcedureChunks = searchEligibleProcedureChunks;

function recheckProcedureSources(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('RecheckProcedureSources', inputVars, inputOpts);
}
exports.recheckProcedureSources = recheckProcedureSources;

function startKnowledgeReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartKnowledgeReview', inputVars, inputOpts);
}
exports.startKnowledgeReview = startKnowledgeReview;

function completeKnowledgeReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CompleteKnowledgeReview', inputVars, inputOpts);
}
exports.completeKnowledgeReview = completeKnowledgeReview;

function recordKnowledgeReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordKnowledgeReview', inputVars, inputOpts);
}
exports.recordKnowledgeReview = recordKnowledgeReview;

function markKnowledgePageReviewed(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkKnowledgePageReviewed', inputVars, inputOpts);
}
exports.markKnowledgePageReviewed = markKnowledgePageReviewed;

function markKnowledgeReady(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('MarkKnowledgeReady', inputVars, inputOpts);
}
exports.markKnowledgeReady = markKnowledgeReady;

function revokeKnowledgeVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RevokeKnowledgeVersion', inputVars, inputOpts);
}
exports.revokeKnowledgeVersion = revokeKnowledgeVersion;

function stageKnowledgeVersion(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StageKnowledgeVersion', inputVars, inputOpts);
}
exports.stageKnowledgeVersion = stageKnowledgeVersion;

function beginKnowledgeExtraction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BeginKnowledgeExtraction', inputVars, inputOpts);
}
exports.beginKnowledgeExtraction = beginKnowledgeExtraction;

function claimKnowledgeExtraction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimKnowledgeExtraction', inputVars, inputOpts);
}
exports.claimKnowledgeExtraction = claimKnowledgeExtraction;

function failKnowledgeExtraction(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('FailKnowledgeExtraction', inputVars, inputOpts);
}
exports.failKnowledgeExtraction = failKnowledgeExtraction;

function knowledgeVersionState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeVersionState', inputVars, inputOpts);
}
exports.knowledgeVersionState = knowledgeVersionState;

function knowledgeDocumentState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeDocumentState', inputVars, inputOpts);
}
exports.knowledgeDocumentState = knowledgeDocumentState;

function knowledgeCommandContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('KnowledgeCommandContext', inputVars, inputOpts);
}
exports.knowledgeCommandContext = knowledgeCommandContext;

function recordOperatorProductReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RecordOperatorProductReview', inputVars, inputOpts);
}
exports.recordOperatorProductReview = recordOperatorProductReview;

function saveProductKnowledgeSnapshot(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveProductKnowledgeSnapshot', inputVars, inputOpts);
}
exports.saveProductKnowledgeSnapshot = saveProductKnowledgeSnapshot;

function claimProductKnowledgeGeneration(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ClaimProductKnowledgeGeneration', inputVars, inputOpts);
}
exports.claimProductKnowledgeGeneration = claimProductKnowledgeGeneration;

function releaseProductKnowledgeGeneration(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReleaseProductKnowledgeGeneration', inputVars, inputOpts);
}
exports.releaseProductKnowledgeGeneration = releaseProductKnowledgeGeneration;

function acceptProductKnowledgeSnapshot(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AcceptProductKnowledgeSnapshot', inputVars, inputOpts);
}
exports.acceptProductKnowledgeSnapshot = acceptProductKnowledgeSnapshot;

function productKnowledgeState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ProductKnowledgeState', inputVars, inputOpts);
}
exports.productKnowledgeState = productKnowledgeState;

function productKnowledgeCatalogPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ProductKnowledgeCatalogPage', inputVars, inputOpts);
}
exports.productKnowledgeCatalogPage = productKnowledgeCatalogPage;

function productKnowledgeActiveAliasPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ProductKnowledgeActiveAliasPage', inputVars, inputOpts);
}
exports.productKnowledgeActiveAliasPage = productKnowledgeActiveAliasPage;

function readProductAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAdmin', inputVars, inputOpts);
}
exports.readProductAdmin = readProductAdmin;

function readProductAdminScope(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAdminScope', inputVars, inputOpts);
}
exports.readProductAdminScope = readProductAdminScope;

function readProductCodeOwner(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductCodeOwner', inputVars, inputOpts);
}
exports.readProductCodeOwner = readProductCodeOwner;

function readProductAdminOperation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAdminOperation', inputVars, inputOpts);
}
exports.readProductAdminOperation = readProductAdminOperation;

function createProductAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateProductAdmin', inputVars, inputOpts);
}
exports.createProductAdmin = createProductAdmin;

function updateProductAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpdateProductAdmin', inputVars, inputOpts);
}
exports.updateProductAdmin = updateProductAdmin;

function setHqStockAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SetHqStockAdmin', inputVars, inputOpts);
}
exports.setHqStockAdmin = setHqStockAdmin;

function readProductAliases(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAliases', inputVars, inputOpts);
}
exports.readProductAliases = readProductAliases;

function readProductAliasRevisions(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAliasRevisions', inputVars, inputOpts);
}
exports.readProductAliasRevisions = readProductAliasRevisions;

function readCollisionProducts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadCollisionProducts', inputVars, inputOpts);
}
exports.readCollisionProducts = readCollisionProducts;

function readCollisionAliases(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadCollisionAliases', inputVars, inputOpts);
}
exports.readCollisionAliases = readCollisionAliases;

function saveProductAliases(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveProductAliases', inputVars, inputOpts);
}
exports.saveProductAliases = saveProductAliases;

function readProductCardAttachment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductCardAttachment', inputVars, inputOpts);
}
exports.readProductCardAttachment = readProductCardAttachment;

function saveProductCardAttachment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveProductCardAttachment', inputVars, inputOpts);
}
exports.saveProductCardAttachment = saveProductCardAttachment;

function upsertPushToken(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertPushToken', inputVars, inputOpts);
}
exports.upsertPushToken = upsertPushToken;

function deletePushToken(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeletePushToken', inputVars, inputOpts);
}
exports.deletePushToken = deletePushToken;

function deletePushTokens(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DeletePushTokens', inputVars, inputOpts);
}
exports.deletePushTokens = deletePushTokens;

function pushRecipients(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('PushRecipients', inputVars, inputOpts);
}
exports.pushRecipients = pushRecipients;

function readReplenishmentSnapshotHeader(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadReplenishmentSnapshotHeader', inputVars, inputOpts);
}
exports.readReplenishmentSnapshotHeader = readReplenishmentSnapshotHeader;

function readReplenishmentProductPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadReplenishmentProductPage', inputVars, inputOpts);
}
exports.readReplenishmentProductPage = readReplenishmentProductPage;

function readReplenishmentAliasPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadReplenishmentAliasPage', inputVars, inputOpts);
}
exports.readReplenishmentAliasPage = readReplenishmentAliasPage;

function readReplenishmentSalonAliasPage(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadReplenishmentSalonAliasPage', inputVars, inputOpts);
}
exports.readReplenishmentSalonAliasPage = readReplenishmentSalonAliasPage;

function issueReplenishmentChoiceReceipts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('IssueReplenishmentChoiceReceipts', inputVars, inputOpts);
}
exports.issueReplenishmentChoiceReceipts = issueReplenishmentChoiceReceipts;

function readSalonShorthandConfirmation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadSalonShorthandConfirmation', inputVars, inputOpts);
}
exports.readSalonShorthandConfirmation = readSalonShorthandConfirmation;

function confirmSalonShorthand(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ConfirmSalonShorthand', inputVars, inputOpts);
}
exports.confirmSalonShorthand = confirmSalonShorthand;

function readSalonAliasOperation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadSalonAliasOperation', inputVars, inputOpts);
}
exports.readSalonAliasOperation = readSalonAliasOperation;

function readSalonShorthandScope(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadSalonShorthandScope', inputVars, inputOpts);
}
exports.readSalonShorthandScope = readSalonShorthandScope;

function removeSalonShorthand(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RemoveSalonShorthand', inputVars, inputOpts);
}
exports.removeSalonShorthand = removeSalonShorthand;

function readProductAliasSeedState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadProductAliasSeedState', inputVars, inputOpts);
}
exports.readProductAliasSeedState = readProductAliasSeedState;

function applyProductAliasSeed(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApplyProductAliasSeed', inputVars, inputOpts);
}
exports.applyProductAliasSeed = applyProductAliasSeed;

function resetProductAdmin(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ResetProductAdmin', inputVars, inputOpts);
}
exports.resetProductAdmin = resetProductAdmin;

function readSeedState(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadSeedState', inputVars, inputOpts);
}
exports.readSeedState = readSeedState;

function readMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadMembership', inputVars, inputOpts);
}
exports.readMembership = readMembership;

function upsertBusiness(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertBusiness', inputVars, inputOpts);
}
exports.upsertBusiness = upsertBusiness;

function upsertLocation(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertLocation', inputVars, inputOpts);
}
exports.upsertLocation = upsertLocation;

function upsertProduct(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertProduct', inputVars, inputOpts);
}
exports.upsertProduct = upsertProduct;

function insertInventory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InsertInventory', inputVars, inputOpts);
}
exports.insertInventory = insertInventory;

function upsertMembership(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertMembership', inputVars, inputOpts);
}
exports.upsertMembership = upsertMembership;

function upsertSalonAccess(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertSalonAccess', inputVars, inputOpts);
}
exports.upsertSalonAccess = upsertSalonAccess;

function insertSalonSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('InsertSalonSettings', inputVars, inputOpts);
}
exports.insertSalonSettings = insertSalonSettings;

function readKnowledgeWipeCounts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadKnowledgeWipeCounts', inputVars, inputOpts);
}
exports.readKnowledgeWipeCounts = readKnowledgeWipeCounts;

function wipeDemoKnowledge(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('WipeDemoKnowledge', inputVars, inputOpts);
}
exports.wipeDemoKnowledge = wipeDemoKnowledge;

function seedProductCardAttachment(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SeedProductCardAttachment', inputVars, inputOpts);
}
exports.seedProductCardAttachment = seedProductCardAttachment;

function seedDeliveryProcedureBindings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SeedDeliveryProcedureBindings', inputVars, inputOpts);
}
exports.seedDeliveryProcedureBindings = seedDeliveryProcedureBindings;

function readResetCounts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ReadResetCounts', inputVars, inputOpts);
}
exports.readResetCounts = readResetCounts;

function resetDemoStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ResetDemoStock', inputVars, inputOpts);
}
exports.resetDemoStock = resetDemoStock;

function approveStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveStock', inputVars, inputOpts);
}
exports.approveStock = approveStock;

function stockContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('StockContext', inputVars, inputOpts);
}
exports.stockContext = stockContext;

function dispatchStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DispatchStock', inputVars, inputOpts);
}
exports.dispatchStock = dispatchStock;

function rejectStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RejectStock', inputVars, inputOpts);
}
exports.rejectStock = rejectStock;

function bindReplayKey(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BindReplayKey', inputVars, inputOpts);
}
exports.bindReplayKey = bindReplayKey;

function submitStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitStock', inputVars, inputOpts);
}
exports.submitStock = submitStock;

