import type { Membership } from './membership.js';
export type SessionState =
  | { status: 'LOADING' | 'SIGNED_OUT' | 'NO_ACCESS' | 'ERROR' }
  | { status: 'READY'; membership: Membership };
