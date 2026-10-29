const { validateAdminArgs } = require('firebase-admin/data-connect');

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
  serviceId: 'barberhq',
  location: 'europe-west1'
};
exports.connectorConfig = connectorConfig;

function getMyMembership(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyMembership', undefined, inputOpts);
}
exports.getMyMembership = getMyMembership;

function listProducts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProducts', inputVars, inputOpts);
}
exports.listProducts = listProducts;

function getSalonInventory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSalonInventory', inputVars, inputOpts);
}
exports.getSalonInventory = getSalonInventory;

function getHqInventory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetHqInventory', inputVars, inputOpts);
}
exports.getHqInventory = getHqInventory;

function getDeliveryProcedureBindings(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetDeliveryProcedureBindings', undefined, inputOpts);
}
exports.getDeliveryProcedureBindings = getDeliveryProcedureBindings;

function listDeliveryProcedureDocuments(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListDeliveryProcedureDocuments', inputVars, inputOpts);
}
exports.listDeliveryProcedureDocuments = listDeliveryProcedureDocuments;

function getDeliveryReceipt(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetDeliveryReceipt', inputVars, inputOpts);
}
exports.getDeliveryReceipt = getDeliveryReceipt;

function getDeliveryIssue(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetDeliveryIssue', inputVars, inputOpts);
}
exports.getDeliveryIssue = getDeliveryIssue;

function listDeliveryIssues(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListDeliveryIssues', inputVars, inputOpts);
}
exports.listDeliveryIssues = listDeliveryIssues;

function getSourceSection(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSourceSection', inputVars, inputOpts);
}
exports.getSourceSection = getSourceSection;

function listPublishedKnowledgeDocuments(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListPublishedKnowledgeDocuments', inputVars, inputOpts);
}
exports.listPublishedKnowledgeDocuments = listPublishedKnowledgeDocuments;

function listHqKnowledgeDocuments(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListHqKnowledgeDocuments', inputVars, inputOpts);
}
exports.listHqKnowledgeDocuments = listHqKnowledgeDocuments;

function getKnowledgeReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetKnowledgeReview', inputVars, inputOpts);
}
exports.getKnowledgeReview = getKnowledgeReview;

function getKnowledgeProductReview(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetKnowledgeProductReview', inputVars, inputOpts);
}
exports.getKnowledgeProductReview = getKnowledgeProductReview;

function listSalonShorthand(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListSalonShorthand', inputVars, inputOpts);
}
exports.listSalonShorthand = listSalonShorthand;

function listHqShorthand(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListHqShorthand', inputVars, inputOpts);
}
exports.listHqShorthand = listHqShorthand;

function getSalonSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSalonSettings', inputVars, inputOpts);
}
exports.getSalonSettings = getSalonSettings;

function saveSalonSettings(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SaveSalonSettings', inputVars, inputOpts);
}
exports.saveSalonSettings = saveSalonSettings;

function listActiveRequests(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListActiveRequests', inputVars, inputOpts);
}
exports.listActiveRequests = listActiveRequests;

function listHqQueue(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListHQQueue', inputVars, inputOpts);
}
exports.listHqQueue = listHqQueue;

function getRequestDetail(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetRequestDetail', inputVars, inputOpts);
}
exports.getRequestDetail = getRequestDetail;

function listSalonRequests(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListSalonRequests', inputVars, inputOpts);
}
exports.listSalonRequests = listSalonRequests;

