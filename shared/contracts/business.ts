export interface PageInput {
  limit: number;
  offset: number;
}
export interface Page<T> {
  items: T[];
  nextOffset: number | null;
}
export interface Membership {
  userId: string;
  businessId: string;
  role: 'HQ' | 'SALON';
  salonIds: string[];
}
export type SessionState =
  | { status: 'LOADING' | 'SIGNED_OUT' | 'NO_ACCESS' | 'ERROR' }
  | { status: 'READY'; membership: Membership };
export interface Product {
  id: string;
  demoId: string;
  name: string;
  brand: string;
  category: string;
  summaryEn: string;
  scentPl: string | null;
  sourceCode: string;
  netContent: { value: number; unit: 'ml' };
  retailPriceGrosz: number;
  sourceUrl: string;
  observedOn: string;
  transferPackSize: null;
  packageDimensionsMm: null;
  shippingWeightGrams: null;
}
export type LocationKey = 'hq' | 'legnicka' | 'lodzka' | 'zakladowa';
export interface Location {
  id: string;
  key: LocationKey;
  name: string;
  kind: 'HQ' | 'SALON';
}
export interface InventoryRow {
  productId: string;
  demoId: string;
  productName: string;
  netContent: { value: number; unit: 'ml' };
  salonId: string;
  salonOnHand: number;
  salonInventoryVersion: number;
  hqOnHand: number;
  hqReserved: number;
  hqAvailable: number;
  hqInventoryVersion: number;
}
/** Seed-only product knowledge: the assistant learns these phrases from data, never from code. */
export interface SeedAlias {
  phrase: string;
  kind: 'NAME' | 'TYPE' | 'PHONETIC';
  lang: 'pl' | 'en';
}
export interface SeedProductKnowledge {
  type: string | null;
  keywords: string[];
  aliases: SeedAlias[];
}
export interface BusinessSeed {
  businessKey: 'not-bad-stuff-demo';
  products: (Product & SeedProductKnowledge)[];
  locations: Location[];
  inventory: {
    locationKey: LocationKey;
    productDemoId: string;
    onHand: number;
    reserved: 0;
  }[];
}
