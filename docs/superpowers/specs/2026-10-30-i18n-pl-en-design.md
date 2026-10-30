# UI language PL/EN — design

30 October 2026. Roadmap item 4, after the readability refactor, before dictation (item 5) and the UI review (item 6).

## Why

The demo audience and salon staff are Polish; the app UI is English only. The owner wants each user to switch the UI between Polish and English, and the procedure assistant to answer in the chosen language. Dictation (item 5) will reuse the same language for speech recognition.

## Goal

A user picks Polish or English from a dropdown; every screen, label, message, date and number switches at once, without reload, and stays chosen on the next visit. In Polish, the procedure assistant answers in Polish, with the same citations as in English.

## Decisions

Owner decisions:

1. **Dropdown to choose the language** ("w ustawieniach"), values `PL` / `EN`.
2. **Translation library:** ngx-translate or Transloco.
3. **Backend receives the language (`en` / `pl`)** as metadata, header or payload, whichever fits.
4. **The assistant accepts questions in either language.** In Polish, the procedure assistant **answers in Polish**, even though most procedure documents are English.

Calls made by the assistant (owner accepted the plan on 30 Oct):

5. **Placement:** the dropdown lives in the account menu (toolbar `account_circle`, next to "Sign out"). Settings exist only per salon (`salons/:salonId/settings`); HQ has none, and the account menu serves both roles and the login page cannot reach it. The login page gets the same compact switcher so the first screen is readable too.
6. **Persistence:** the choice is stored in the browser (`localStorage`, key `barberhq.language`), wrapped in try/catch. Default when nothing is stored: `pl` if `navigator.language` starts with `pl`, otherwise `en`. No server-side profile.
7. **Library: Transloco** (`@jsverse/transloco` 8.x, peer `@angular/core >=16`). Signal-friendly API, testing module, runtime switch without reload. Translation files: `web/public/i18n/en.json` and `web/public/i18n/pl.json`, nested keys per feature (`shell.*`, `replenishment.*`, `procedures.*`, `common.*` …). English is the fallback language; a missing Polish key shows the English text, never the key.
8. **Transport to the backend: a payload field.** The Firebase web `httpsCallable` cannot set custom headers (options are only `timeout` and App Check token mode). The procedure callable already has `answerLanguage` in its contract (`shared/contracts/ai/procedure-input.ts`, type `'en' | 'pl'`), but the Functions schema pins it to `z.literal('en')` and the web facade always sends `'en'`. Widen the schema to `z.enum(['en', 'pl'])` and send the UI language.
9. **Only the procedure assistant gets the language.** The replenishment assistant's model only extracts product phrases and quantities verbatim; every message the user reads there is built by the web app from codes. It already handles Polish and English input and needs no language field. Other callables (stock, delivery, knowledge, aliases) return data and error codes, not prose.
10. **Procedure prompt:** replace "Answer the English procedure question" with an instruction to write every user-visible string (`steps[].text`, `missingInformation`, `question`, `message`) in the requested language (`English` / `Polish`), whatever the question's or evidence's language, while keeping `sourceSectionIds` and `searchQuery` rules unchanged. Retrieval is unchanged: it does not filter by language, and the embedding model is multilingual.
11. **Dates and numbers** follow the UI language: Angular `LOCALE_ID` / pipes and any `Intl` / `toLocale*` calls use `pl-PL` or the English locale (exact one left to the builder). Polish locale data is registered (`registerLocaleData(localePl)`).
12. **`<html lang>`** follows the UI language (accessibility, screen readers, future dictation).

## Scope — what is translated

- All UI text: ~260 text nodes in 19 HTML templates, ~200 user-visible strings in TypeScript (snack bars, error mappings, status and enum labels, aria-labels, titles, placeholders, example questions).
- Existing hard-coded Polish example questions (`procedure-question.ts`, `procedure-assistant.component.ts`) become translation keys with an English and a Polish version.
- Page titles (`Title` / route `title`), if set.

## Not translated (non-goals)

- Data from the database or documents: product names, units as stored, procedure and product-card content, salon aliases, request notes, uploaded file names.
- Server-side logs and error messages not shown to users.
- The replenishment assistant's verbatim `originalWording` (it is the user's own text).
- Languages beyond PL and EN; per-user server-side preference; translating `docs/`.

## Anti-goals

- Visible translation keys (`replenishment.title`) anywhere in the app.
- A full page reload or lost form state when switching language.
- A Polish answer whose citations differ in quality from the English one (steps without valid `sourceSectionIds`).
- Breaking the existing Polish/English questions to the assistants.

## Constraints

- Angular 22 standalone, signals, zoneless as today; follow `docs/implementation/angular-architecture.md` (facades, data-access layers).
- Language state lives in one injectable (e.g. `core/language.ts`) exposing a signal `language(): 'en' | 'pl'` and `setLanguage(lang)`; Transloco's active language, `<html lang>`, locale-dependent formatting and the procedure facade all read from it.
- Keep the code-structure rules from item 3 (`tests/unit/code-structure.test.ts`): models one per file, logic files ≤ ~300 lines.
- Existing web unit tests keep passing; tests that assert English text keep English as the test language (Transloco testing module with the English file).
- AGENTS.md: never read `*.local.json` / `.env`.
- No prod deploy in this item; the next release carries it (Functions + web). Running the RAG eval against Vertex costs money and needs explicit owner approval.

## Proof

- A unit test fails if `en.json` and `pl.json` have different key sets, or if any template/TS key used in code is missing from `en.json` (a key-extraction check or Transloco's keys manager / a small script).
- Web unit tests: language service (default from `navigator.language`, persistence, storage failure falls back silently), dropdown switches language and `<html lang>`, procedure facade sends the current language.
- Functions unit tests: `parseProcedureInput` accepts `en` and `pl`, rejects others; the prompt for `pl` asks for Polish output.
- E2E (emulators): switch to Polish in the account menu → the shell and one screen per role show Polish text; reload keeps Polish.
- Manual, with owner approval (Vertex cost): one procedure question per language through the emulator stack or `scripts/eval/rag`, checking the Polish answer has valid citations.

## Settled after the builder check (assistant's calls)

13. **Fixed procedure messages:** `functions/src/ai/procedure.ts` returns two fixed English `INSUFFICIENT_EVIDENCE` messages ("No eligible source supports this question.", "The available sources do not cover the requested detail."). They get a Polish version selected by `answerLanguage` in Functions. Callable errors are already codes (`publicAiError`), mapped to text in the web app.
14. **No answer cache exists** (checked: no cache or dedupe on question in the procedure path), so no cache key changes. The Genkit flow schema in `procedure.ts` already accepts `z.enum(['en','pl'])`; only `schemas.ts` pins `'en'`.
15. **Switching language with an answer on screen:** a model answer already shown stays as-is (it is model text); the next question uses the new language. Everything the web app builds (status, errors, labels) is stored as codes or keys and re-renders in the new language.
16. **Live formatting:** no reload. `LOCALE_ID` stays fixed; the few date/number formats (none use `DatePipe` today; ~20 `Intl` / `toLocale*` / format sites) read the locale from the language service, through one small locale-aware helper or pipe.
17. **Loading:** Transloco HTTP loader from `/i18n/{lang}.json`; the active language is preloaded before first render (`provideAppInitializer`), so keys never flash. Unit tests import `web/public/i18n/en.json` directly into the Transloco testing module.
18. **Key check:** enum and status labels use typed maps (`Record<Status, string>` of literal keys), not template-string keys, so a literal-key extraction check covers them; the test also checks that `en.json` and `pl.json` have identical key sets.
19. **Browser default applies once**, only when nothing is stored; an explicit choice always wins.

## Left to the builder

- Key naming within features; how strings in TS are translated (`translate()` in facades vs. keys returned to templates).
- English locale for dates (`en-GB` vs `en-US`); pick one and use it consistently.
- Whether `scripts/eval/rag` gets a Polish case set now or later.
- Exact Polish wording (natural, short UI Polish; domain terms consistent: "zamówienie", "stan magazynowy", "dostawa", "salon", "centrala/HQ").
