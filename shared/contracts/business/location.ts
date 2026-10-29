import type { LocationKey } from './location-key.js';
export interface Location {
  id: string;
  key: LocationKey;
  name: string;
  kind: 'HQ' | 'SALON';
}
