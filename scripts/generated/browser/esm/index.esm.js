import { validateAdminArgs } from 'firebase-admin/data-connect';

export const MemberRole = {
  HQ: "HQ",
  SALON: "SALON",
}

export const connectorConfig = {
  connector: 'browser',
  serviceId: 'barberhq',
  location: 'europe-west1'
};

export function getMyMembership(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyMembership', undefined, inputOpts);
}

export function listProducts(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, false);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListProducts', inputVars, inputOpts);
}

export function getSalonInventory(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetSalonInventory', inputVars, inputOpts);
}

