import { describe, expect, it } from 'vitest';
import { formatDictationReport } from '../../scripts/dev/evaluate-dictation.ts';

describe('formatDictationReport', () => {
  it('compares transcripts with keyboard lines and escapes table cells', () => {
    const report = formatDictationReport([
      { file: 'a.m4a', keyboard: '2 Matowa', transcript: '2 matowa.' },
      { file: 'b.webm', keyboard: '3 sól | morska', transcript: 'trzy sole' },
      { file: 'c.webm', keyboard: '', transcript: '', error: 'NO_SPEECH' },
    ]);
    expect(report).toContain('3 recordings, 1 identical');
    expect(report).toContain('| a.m4a | 2 Matowa | 2 matowa. | yes |');
    expect(report).toContain('| b.webm | 3 sól \\| morska | trzy sole | no |');
    expect(report).toContain('| c.webm |   | ERROR NO_SPEECH | error |');
  });
});
