const { validateAdminArgs } = require('firebase-admin/data-connect');

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

const RequestState = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  RESERVED: "RESERVED",
  DISPATCHED: "DISPATCHED",
  RECEIVED: "RECEIVED",
  REJECTED: "REJECTED",
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

function stockContext(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('StockContext', inputVars, inputOpts);
}
exports.stockContext = stockContext;

function submitStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('SubmitStock', inputVars, inputOpts);
}
exports.submitStock = submitStock;

function approveStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ApproveStock', inputVars, inputOpts);
}
exports.approveStock = approveStock;

function rejectStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('RejectStock', inputVars, inputOpts);
}
exports.rejectStock = rejectStock;

function dispatchStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('DispatchStock', inputVars, inputOpts);
}
exports.dispatchStock = dispatchStock;

function receiveStock(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('ReceiveStock', inputVars, inputOpts);
}
exports.receiveStock = receiveStock;

function bindReplayKey(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('BindReplayKey', inputVars, inputOpts);
}
exports.bindReplayKey = bindReplayKey;

