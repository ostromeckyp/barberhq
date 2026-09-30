import { InjectionToken } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} from 'firebase/auth';
import { getDataConnect, connectDataConnectEmulator } from 'firebase/data-connect';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectorConfig, getMyMembership, MemberRole } from './generated';
import { runtimeConfig } from './public-config';
import type { SessionGateway } from './session.gateway';
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
  const data = getDataConnect(app, connectorConfig);
  if (runtimeConfig.useEmulators) {
    if (!c.projectId.startsWith('demo-') || !['localhost', '127.0.0.1'].includes(location.hostname))
      throw new Error('Emulators require an explicit local demo project.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDataConnectEmulator(data, '127.0.0.1', 9399);
  } else
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(c.appCheck.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  return { auth, data };
}
export const FIREBASE = new InjectionToken<ReturnType<typeof createFirebase>>('Firebase', {
  providedIn: 'root',
  factory: createFirebase,
});
export function createSessionGateway(firebase: ReturnType<typeof createFirebase>): SessionGateway {
  return {
    observe: (callback) => onAuthStateChanged(firebase.auth, (user) => callback(user?.uid ?? null)),
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(firebase.auth, email, password);
    },
    signOut: () => signOut(firebase.auth),
    membership: async () => {
      const m = (await getMyMembership(firebase.data)).data.membership;
      if (!m) return null;
      const salons =
        m.role === MemberRole.HQ
          ? m.business.locations_on_business
          : m.salonAccesses_on_membership
              .filter((a) => a.location.businessId === m.businessId && a.location.kind === 'SALON')
              .map((a) => a.location);
      return {
        membership: {
          userId: m.uid,
          businessId: m.businessId,
          role: m.role,
          salonIds: salons.map((s) => s.id),
        },
        salons: salons.map((s) => ({ id: s.id, name: s.name })),
      };
    },
  };
}
