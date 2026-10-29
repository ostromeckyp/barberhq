import { InjectionToken } from '@angular/core';
import type { ResolvedMember } from '../models/resolved-member';
export interface SessionGateway {
  observe(callback: (uid: string | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  membership(): Promise<ResolvedMember | null>;
}
export const SESSION_GATEWAY = new InjectionToken<SessionGateway>('Session gateway');
