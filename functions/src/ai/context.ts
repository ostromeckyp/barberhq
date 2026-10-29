import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { AiError } from './budget.js';

export function createAiAdminDependencies(
  auth: Pick<ReturnType<typeof getAuth>, 'verifyIdToken'> = getAuth(),
  appCheck: Pick<ReturnType<typeof getAppCheck>, 'verifyToken'> = getAppCheck(),
): AiUserDependencies {
  return {
    verifyAuth: async (token, checkRevoked) => {
      try {
        return (await auth.verifyIdToken(token, checkRevoked)).uid;
      } catch {
        return null;
      }
    },
    verifyAppCheck: async (token) => {
      try {
        await appCheck.verifyToken(token);
        return true;
      } catch {
        return false;
      }
    },
  };
}

const profiles = new WeakSet<object>();
export type AiRuntimeProfile = Readonly<{ demoLoopbackEmulator: boolean }>;

function loopback(host: string | undefined): boolean {
  return Boolean(
    host &&
    /^(?:127\.0\.0\.1|localhost|\[::1\]):(?:[1-9]\d{0,4})$/.test(host) &&
    Number(host.slice(host.lastIndexOf(':') + 1)) <= 65535,
  );
}

/** App Check bypass is constructed only from the server's explicit local runtime. */
export function createAiRuntimeProfile(input: {
  emulator: boolean;
  projectId?: string;
  authHost?: string;
  sqlHost?: string;
}): AiRuntimeProfile {
  if (input.emulator) {
    if (
      input.projectId !== 'demo-barberhq' ||
      !loopback(input.authHost) ||
      !loopback(input.sqlHost)
    )
      throw new AiError('INVALID_CONFIG');
  } else if (input.projectId !== 'notbad-6be95' || input.authHost || input.sqlHost) {
    throw new AiError('INVALID_CONFIG');
  }
  const profile = Object.freeze({ demoLoopbackEmulator: input.emulator });
  profiles.add(profile);
  return profile;
}

export function aiRuntimeProfileFromEnv(): AiRuntimeProfile {
  return createAiRuntimeProfile({
    emulator: process.env.FUNCTIONS_EMULATOR === 'true',
    projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
    authHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    sqlHost: process.env.DATA_CONNECT_EMULATOR_HOST,
  });
}

export type ActorContext = Readonly<{
  uid: string;
  businessId: string;
  role: 'HQ' | 'SALON';
  salonIds: readonly string[];
}>;

export type AiUserRequest<T> = {
  data: T;
  authUid?: string;
  idToken?: string;
  appCheckToken?: string;
};

export type AiUserDependencies = {
  verifyAuth(token: string, checkRevoked: true): Promise<string | null>;
  verifyAppCheck(token: string): Promise<boolean>;
};

/** The caller supplies a server-validated profile, never a request field. */
export function createAiUserEndpoint<T, R>(
  operation: (uid: string, data: T) => Promise<R>,
  dependencies: AiUserDependencies,
  profile: AiRuntimeProfile,
) {
  return async (request: AiUserRequest<T>): Promise<R> => {
    if (!profiles.has(profile)) throw new AiError('INVALID_CONFIG');
    let uid: string | null = null;
    try {
      uid = request.idToken ? await dependencies.verifyAuth(request.idToken, true) : null;
    } catch {
      throw new AiError('UNAUTHENTICATED');
    }
    if (!uid || uid !== request.authUid) throw new AiError('UNAUTHENTICATED');
    if (!profile.demoLoopbackEmulator) {
      let valid = false;
      try {
        valid = Boolean(
          request.appCheckToken && (await dependencies.verifyAppCheck(request.appCheckToken)),
        );
      } catch {
        /* A verifier failure never grants access. */
      }
      if (!valid) throw new AiError('APP_CHECK_REQUIRED');
    }
    if (typeof request.data !== 'object' || request.data === null || Array.isArray(request.data)) {
      throw new AiError('VALIDATION_ERROR');
    }
    const data = request.data as Record<string, unknown>;
    if (
      ['uid', 'actorUid', 'actorId', 'businessId', 'role', 'salonIds'].some((key) =>
        Object.hasOwn(data, key),
      )
    ) {
      throw new AiError('VALIDATION_ERROR');
    }
    try {
      return await operation(uid, request.data);
    } catch (error) {
      if (error instanceof AiError) throw error;
      throw new AiError('SERVICE_UNAVAILABLE');
    }
  };
}
