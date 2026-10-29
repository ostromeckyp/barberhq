const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

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

const RequestState = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  RESERVED: "RESERVED",
  DISPATCHED: "DISPATCHED",
  RECEIVED: "RECEIVED",
  REJECTED: "REJECTED",
  RECEIVED_WITH_ISSUE: "RECEIVED_WITH_ISSUE",
}
exports.RequestState = RequestState;

const connectorConfig = {
  connector: 'browser',
  service: 'barberhq',
  location: 'europe-west1'
};
exports.connectorConfig = connectorConfig;

const getMyMembershipRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyMembership');
}
getMyMembershipRef.operationName = 'GetMyMembership';
exports.getMyMembershipRef = getMyMembershipRef;

exports.getMyMembership = function getMyMembership(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyMembershipRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listProductsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListProducts', inputVars);
}
listProductsRef.operationName = 'ListProducts';
exports.listProductsRef = listProductsRef;

exports.listProducts = function listProducts(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, false);
  return executeQuery(listProductsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSalonInventoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSalonInventory', inputVars);
}
getSalonInventoryRef.operationName = 'GetSalonInventory';
exports.getSalonInventoryRef = getSalonInventoryRef;

exports.getSalonInventory = function getSalonInventory(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSalonInventoryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getHqInventoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetHqInventory', inputVars);
}
getHqInventoryRef.operationName = 'GetHqInventory';
exports.getHqInventoryRef = getHqInventoryRef;

exports.getHqInventory = function getHqInventory(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, false);
  return executeQuery(getHqInventoryRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getDeliveryReceiptRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDeliveryReceipt', inputVars);
}
getDeliveryReceiptRef.operationName = 'GetDeliveryReceipt';
exports.getDeliveryReceiptRef = getDeliveryReceiptRef;

exports.getDeliveryReceipt = function getDeliveryReceipt(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getDeliveryReceiptRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getDeliveryIssueRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDeliveryIssue', inputVars);
}
getDeliveryIssueRef.operationName = 'GetDeliveryIssue';
exports.getDeliveryIssueRef = getDeliveryIssueRef;

exports.getDeliveryIssue = function getDeliveryIssue(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getDeliveryIssueRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listDeliveryIssuesRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDeliveryIssues', inputVars);
}
listDeliveryIssuesRef.operationName = 'ListDeliveryIssues';
exports.listDeliveryIssuesRef = listDeliveryIssuesRef;

exports.listDeliveryIssues = function listDeliveryIssues(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listDeliveryIssuesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getDeliveryProcedureBindingsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetDeliveryProcedureBindings');
}
getDeliveryProcedureBindingsRef.operationName = 'GetDeliveryProcedureBindings';
exports.getDeliveryProcedureBindingsRef = getDeliveryProcedureBindingsRef;

exports.getDeliveryProcedureBindings = function getDeliveryProcedureBindings(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getDeliveryProcedureBindingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listDeliveryProcedureDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListDeliveryProcedureDocuments', inputVars);
}
listDeliveryProcedureDocumentsRef.operationName = 'ListDeliveryProcedureDocuments';
exports.listDeliveryProcedureDocumentsRef = listDeliveryProcedureDocumentsRef;

exports.listDeliveryProcedureDocuments = function listDeliveryProcedureDocuments(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, false);
  return executeQuery(listDeliveryProcedureDocumentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSourceSectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSourceSection', inputVars);
}
getSourceSectionRef.operationName = 'GetSourceSection';
exports.getSourceSectionRef = getSourceSectionRef;

exports.getSourceSection = function getSourceSection(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSourceSectionRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listPublishedKnowledgeDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListPublishedKnowledgeDocuments', inputVars);
}
listPublishedKnowledgeDocumentsRef.operationName = 'ListPublishedKnowledgeDocuments';
exports.listPublishedKnowledgeDocumentsRef = listPublishedKnowledgeDocumentsRef;

exports.listPublishedKnowledgeDocuments = function listPublishedKnowledgeDocuments(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listPublishedKnowledgeDocumentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listHqKnowledgeDocumentsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListHqKnowledgeDocuments', inputVars);
}
listHqKnowledgeDocumentsRef.operationName = 'ListHqKnowledgeDocuments';
exports.listHqKnowledgeDocumentsRef = listHqKnowledgeDocumentsRef;

exports.listHqKnowledgeDocuments = function listHqKnowledgeDocuments(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listHqKnowledgeDocumentsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getKnowledgeReviewRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetKnowledgeReview', inputVars);
}
getKnowledgeReviewRef.operationName = 'GetKnowledgeReview';
exports.getKnowledgeReviewRef = getKnowledgeReviewRef;

exports.getKnowledgeReview = function getKnowledgeReview(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getKnowledgeReviewRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getKnowledgeProductReviewRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetKnowledgeProductReview', inputVars);
}
getKnowledgeProductReviewRef.operationName = 'GetKnowledgeProductReview';
exports.getKnowledgeProductReviewRef = getKnowledgeProductReviewRef;

exports.getKnowledgeProductReview = function getKnowledgeProductReview(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getKnowledgeProductReviewRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listSalonShorthandRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSalonShorthand', inputVars);
}
listSalonShorthandRef.operationName = 'ListSalonShorthand';
exports.listSalonShorthandRef = listSalonShorthandRef;

exports.listSalonShorthand = function listSalonShorthand(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listSalonShorthandRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listHqShorthandRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListHqShorthand', inputVars);
}
listHqShorthandRef.operationName = 'ListHqShorthand';
exports.listHqShorthandRef = listHqShorthandRef;

exports.listHqShorthand = function listHqShorthand(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listHqShorthandRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getSalonSettingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSalonSettings', inputVars);
}
getSalonSettingsRef.operationName = 'GetSalonSettings';
exports.getSalonSettingsRef = getSalonSettingsRef;

exports.getSalonSettings = function getSalonSettings(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getSalonSettingsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const saveSalonSettingsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'SaveSalonSettings', inputVars);
}
saveSalonSettingsRef.operationName = 'SaveSalonSettings';
exports.saveSalonSettingsRef = saveSalonSettingsRef;

exports.saveSalonSettings = function saveSalonSettings(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(saveSalonSettingsRef(dcInstance, inputVars));
}
;

const listActiveRequestsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListActiveRequests', inputVars);
}
listActiveRequestsRef.operationName = 'ListActiveRequests';
exports.listActiveRequestsRef = listActiveRequestsRef;

exports.listActiveRequests = function listActiveRequests(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listActiveRequestsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listHqQueueRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListHQQueue', inputVars);
}
listHqQueueRef.operationName = 'ListHQQueue';
exports.listHqQueueRef = listHqQueueRef;

exports.listHqQueue = function listHqQueue(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, false);
  return executeQuery(listHqQueueRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getRequestDetailRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRequestDetail', inputVars);
}
getRequestDetailRef.operationName = 'GetRequestDetail';
exports.getRequestDetailRef = getRequestDetailRef;

exports.getRequestDetail = function getRequestDetail(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getRequestDetailRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listSalonRequestsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListSalonRequests', inputVars);
}
listSalonRequestsRef.operationName = 'ListSalonRequests';
exports.listSalonRequestsRef = listSalonRequestsRef;

exports.listSalonRequests = function listSalonRequests(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(listSalonRequestsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
