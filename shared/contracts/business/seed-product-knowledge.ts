import type { SeedAlias } from './seed-alias.js';
export interface SeedProductKnowledge {
  type: string | null;
  keywords: string[];
  aliases: SeedAlias[];
}
