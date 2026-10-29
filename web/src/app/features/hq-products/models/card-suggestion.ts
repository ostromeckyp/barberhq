export type CardSuggestion = {
  phrase: string;
  kind: 'NAME' | 'PHONETIC' | 'TYPE';
  collisions: string[];
};
