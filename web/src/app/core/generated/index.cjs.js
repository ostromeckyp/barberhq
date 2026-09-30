const { queryRef, executeQuery, validateArgsWithOptions, validateArgs } = require('firebase/data-connect');

const MemberRole = {
  HQ: "HQ",
  SALON: "SALON",
}
exports.MemberRole = MemberRole;

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
