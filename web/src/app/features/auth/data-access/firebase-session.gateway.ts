import { QueryFetchPolicy } from 'firebase/data-connect';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getMyMembership, MemberRole } from '../../../core/generated';
import type { createFirebase } from '../../../core/firebase.providers';
import type { SessionGateway } from './session.gateway';

export function createSessionGateway(firebase: ReturnType<typeof createFirebase>): SessionGateway {
  return {
    observe: (callback) => onAuthStateChanged(firebase.auth, (user) => callback(user?.uid ?? null)),
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(firebase.auth, email, password);
    },
    signOut: () => signOut(firebase.auth),
    membership: async () => {
      const m = (
        await getMyMembership(firebase.data, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })
      ).data.membership;
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
