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
  it('rejects blank questions', () => {
    expect(() => parseProcedureInput({ question: ' ', answerLanguage: 'en' })).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
  it('accepts en and pl, rejects other languages', () => {
    expect(parseProcedureInput({ question: 'safe steps?', answerLanguage: 'en' })).toEqual({
      question: 'safe steps?',
      answerLanguage: 'en',
    });
    expect(parseProcedureInput({ question: 'bezpieczne kroki?', answerLanguage: 'pl' })).toEqual({
      question: 'bezpieczne kroki?',
      answerLanguage: 'pl',
    });
    expect(() =>
      parseProcedureInput({ question: 'safe steps?', answerLanguage: 'de' }),
    ).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
