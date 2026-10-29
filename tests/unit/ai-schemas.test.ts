import { describe, expect, it } from 'vitest';
import { parsePrepareInput, parseProcedureInput } from '../../functions/src/ai/schemas.ts';

describe('AI server input schemas', () => {
  it('accepts a 2000 character message and rejects overflow and client scope claims', () => {
    expect(parsePrepareInput({ salonId: 'salon', message: 'x'.repeat(2000) }).message).toHaveLength(
      2000,
    );
    expect(() => parsePrepareInput({ salonId: 'salon', message: 'x'.repeat(2001) })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      parsePrepareInput({ salonId: 'salon', message: 'hi', businessId: 'foreign' }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
  it('rejects blank questions and unevaluated language', () => {
    expect(() => parseProcedureInput({ question: ' ', answerLanguage: 'en' })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      parseProcedureInput({ question: 'safe steps?', answerLanguage: 'pl' }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(parseProcedureInput({ question: 'safe steps?', answerLanguage: 'en' })).toEqual({
      question: 'safe steps?',
      answerLanguage: 'en',
    });
  });
});
