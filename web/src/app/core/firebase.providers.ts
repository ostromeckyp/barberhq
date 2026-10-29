import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { InjectionToken } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectorConfig } from './generated';
import { runtimeConfig } from './public-config';
export function createFirebase() {
  const c = runtimeConfig.publicConfig;
  if (!c) throw new Error('Firebase configuration is missing.');
  if (
    c.dataConnect.serviceId !== connectorConfig.service ||
    c.dataConnect.location !== connectorConfig.location ||
    c.dataConnect.browserConnectorId !== connectorConfig.connector
  )
    throw new Error('Configuration does not match generated SDK.');
  const app = initializeApp(c.firebase);
  const auth = getAuth(app);
  const functions = getFunctions(app, c.functionsRegion);
  const data = getDataConnect(app, connectorConfig);
  let appCheck = null;
  if (runtimeConfig.useEmulators) {
    if (!c.projectId.startsWith('demo-') || !['localhost', '127.0.0.1'].includes(location.hostname))
      throw new Error('Emulators require an explicit local demo project.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDataConnectEmulator(data, '127.0.0.1', 9399);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  } else
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(c.appCheck.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  return { auth, data, functions, appCheck };
}
export const FIREBASE = new InjectionToken<ReturnType<typeof createFirebase>>('Firebase', {
  providedIn: 'root',
  factory: createFirebase,
});
