import type { MatchLine } from './match-line.js';

export type MatchRequest = {
  language: 'pl' | 'en';
  lines: Omit<MatchLine, 'quantity'>[];
  /** The salon's scoped catalog card: the matcher's only product knowledge. */
  catalog: {
    productId: string;
    name: string;
    type: string;
    category: string;
    keywords: string[];
    aliases: string[];
    salonShorthand: string[];
  }[];
};
