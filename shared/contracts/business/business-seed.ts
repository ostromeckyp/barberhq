import type { Location } from './location.js';
import type { LocationKey } from './location-key.js';
import type { Product } from './product.js';
import type { SeedProductKnowledge } from './seed-product-knowledge.js';
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
