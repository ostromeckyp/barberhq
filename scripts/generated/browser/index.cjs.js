const { validateAdminArgs } = require('firebase-admin/data-connect');

const MemberRole = {
  HQ: "HQ",
  SALON: "SALON",
}
exports.MemberRole = MemberRole;

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

