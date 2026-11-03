import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export type DictationRow = {
  file: string;
  /** The line typed by hand for the same order; empty when keyboard.txt is shorter. */
  keyboard: string;
  transcript: string;
  error?: string;
};

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Markdown comparison of dictated transcripts with the keyboard lines; pure, no I/O. */
export function formatDictationReport(rows: DictationRow[]): string {
  const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || ' ';
  const same = rows.filter(
    (r) => !r.error && r.keyboard && normalise(r.keyboard) === normalise(r.transcript),
  );
  return [
    '# Dictation evaluation',
    '',
    `${rows.length} recordings, ${same.length} identical to the keyboard text after normalisation.`,
    '',
    '| File | Keyboard | Transcript | Same |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${cell(r.file)} | ${cell(r.keyboard)} | ${cell(r.error ? `ERROR ${r.error}` : r.transcript)} | ${
          r.error
            ? 'error'
            : r.keyboard && normalise(r.keyboard) === normalise(r.transcript)
              ? 'yes'
              : 'no'
        } |`,
    ),
    '',
  ].join('\n');
}

const mimeByExtension: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      dir: { type: 'string' },
      out: { type: 'string' },
      language: { type: 'string', default: 'pl' },
      'transcribe-only': { type: 'boolean' },
    },
  });
  if (!values.dir || !values.out || !values['transcribe-only'])
    throw new Error('Pass --dir FOLDER --out REPORT.md --transcribe-only [--language pl|en]');
  const language = values.language === 'en' ? 'en' : 'pl';
  const dir = resolve(values.dir);
  const files = readdirSync(dir)
    .filter((f) => extname(f) in mimeByExtension)
    .sort();
  const lines = readFileSync(join(dir, 'keyboard.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  // Read-only Vertex calls with the owner's gcloud application-default credentials.
  const { createTranscribeProvider } =
    await import('../../functions/src/ai/transcription-model.ts');
  const { createAiBudget } = await import('../../functions/src/ai/budget.ts');
  const transcribe = createTranscribeProvider();
  const rows: DictationRow[] = [];
  for (const [i, file] of files.entries()) {
    const row: DictationRow = { file, keyboard: lines[i] ?? '', transcript: '' };
    try {
      row.transcript = (
        await transcribe(createAiBudget(Date.now()), {
          audio: readFileSync(join(dir, file)),
          mimeType: mimeByExtension[extname(file)]!,
          language,
        })
      ).trim();
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
    console.log(`${file}: ${row.error ? `ERROR ${row.error}` : row.transcript}`);
  }
  writeFileSync(values.out, formatDictationReport(rows));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
