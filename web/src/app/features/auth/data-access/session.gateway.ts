import { InjectionToken } from '@angular/core';
import type { Membership } from '../../../../../../shared/contracts/business';
export interface SalonOption {
  id: string;
  name: string;
}
export interface ResolvedMember {
  membership: Membership;
  salons: SalonOption[];
}
export interface SessionGateway {
  observe(callback: (uid: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  membership(): Promise<ResolvedMember | null>;
}
export const SESSION_GATEWAY = new InjectionToken<SessionGateway>('Session gateway');
