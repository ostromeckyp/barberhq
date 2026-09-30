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

