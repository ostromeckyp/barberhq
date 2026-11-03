# Voice Order and AI Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salon staff dictate an order into a cleaned, editable text, and unresolved phrases are matched to catalog products by Gemini (single high-confidence match goes into the draft, labelled and changeable).

**Architecture:** A new `ai` op `transcribeOrder` sends a short recording (inline base64) to the existing Vertex Gemini model with a no-catalog cleaning prompt and returns text. Inside `prepareReplenishment`, after turn 1 and the deterministic lookup, a second model turn `matchProducts` ranks catalog candidates for `NONE`/`CONTAINS`/ambiguous lines; `finalProposal` applies the auto-match rules, issues choice receipts, and returns additive `aiMatch` / `suggested` fields. The web adds a recorder service in `core/`, a mic control on the assistant input, and the AI-match label + change flow.

**Tech Stack:** Firebase Functions v2 + Genkit `@genkit-ai/vertexai` (`gemini-3.5-flash-lite`), Data Connect server connector, Angular 22 (signals, zoneless, Material, Transloco), `MediaRecorder`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-voice-order-and-ai-matching-design.md`

## Global Constraints

- `AGENTS.md`: TDD; en + pl Transloco keys for every visible text; logic files ≤ 300 lines; one exported model per file; web layering component → facade → data-access → core; components never call Firebase or `MediaRecorder` directly.
- Never read, print, grep, copy or edit `*.local.json` / `.env`. No production writes (deploy, db, IAM) — the plan ends at a PR; owner steps are listed in Task 7.
- `ai` callable options unchanged (`region: europe-west1`, `maxInstances: 5`, App Check as today); no new callable service.
- Contracts change additively; existing clients keep working.
- Audio is never written to Storage, DB or logs; logs never contain the transcript.
- Quantities come only from the user's words; never default to 1.
- AI auto-match only on lines whose deterministic tier is `NONE` or `CONTAINS`; exactly one valid catalog candidate with `confidence: 'HIGH'` and a quantity. Everything else stays a clarification (AI suggestions first).
- AI auto-match never teaches shorthand; a user choice (clarification or "change") teaches as today via receipts.
- Hourly AI limit per user: 20 (was 10).
- Limits: recording ≤ 30 s at `audioBitsPerSecond: 64000`; decoded audio ≤ 1 MB; transcript ≤ 2000 chars; AI `reason` ≤ 120 chars; ≤ 3 AI candidates per line.
- Work on branch `feat/voice-order` from `main`.

## Review Focus

1. Gemini returns a productId not in the salon catalog, or for a lineId it was not asked about: it must be dropped, never reach the draft. Task 3 test.
2. Recording on iOS PWA: permission denied, recorder unsupported, recording stopped by 30 s cap, app backgrounded mid-recording: UI returns to idle with a clear message, no stuck "recording" state. Task 5 tests.
3. `matchProducts` slow or failing under the 25 s shared deadline: the order result equals today's, no error surfaced. Task 3 test with a rejecting/hanging matcher.
4. A transcript appended to a textarea that already has text, and pushing it over 2000 chars: truncated or rejected with the existing max-length validation, never silently sent oversize. Task 5 test.
5. User changes an AI-matched line: the choice uses `aiMatch.choiceReceiptId` and teaches shorthand; leaving it untouched teaches nothing. Task 3 + Task 6 tests.

---

### Task 0: Extra phonetic aliases for the demo catalog (after owner review)

**Files:**
- Modify: `data/seed/business.json` (append `{ "phrase", "kind": "PHONETIC", "lang": "pl" }` entries to the products' `aliases`, exactly the owner-approved list)
- Test: `tests/unit/product-alias-seed.test.ts` (or a new focused test)

- [ ] **Step 1: Failing test:** every approved phrase is present for its product; no normalized phrase (`normalizeProductForMatch`) appears on two different products; no new phrase duplicates an existing alias of the same product after normalization.
- [ ] **Step 2:** run → FAIL. **Step 3:** add the entries. **Step 4:** `npm run test:unit` → pass.
- [ ] **Step 5:** commit `feat(seed): more phonetic aliases for the demo catalog`. Production alias seeding is an owner step (Task 7 runbook), via the existing `scripts/seed/product-aliases.ts` CLI.

### Task 1: Raise the hourly AI limit to 20

**Files:**
- Modify: `dataconnect/server/ai/admission.gql` (`WHERE ai_usage_window.count < 10` → `< 20`)
- Modify: `tests/unit/ai-admission.test.ts` (loop and boundary pinned to 10)
- Modify: any doc stating 10 AI calls/hour (grep `docs/` and `AGENTS.md`)
- Regenerate SDK only if the generator requires it (`npm run generate:sdk -- --project demo-barberhq`); commit regenerated tracked files.

- [ ] **Step 1:** change the test first: 19 admitted calls succeed, the 21st (after 20) rejects with `RATE_LIMITED`; also add a text-level assertion that `admission.gql` contains `count < 20`. Run `npx vitest run tests/unit/ai-admission.test.ts` → FAIL.
- [ ] **Step 2:** change the SQL. Run the test → PASS; `npm run test:unit` → pass.
- [ ] **Step 3:** commit `feat(ai): raise hourly AI calls per user to 20`.

### Task 2: `transcribeOrder` op (functions)

**Files:**
- Create: `functions/src/ai/transcription.ts` — `createTranscribeOrderFunction()`, `createOrderTranscriber(deps)`
- Create: `functions/src/ai/transcription-prompt.ts` — `transcriptionInstruction(language: 'pl' | 'en'): string`
- Create: `functions/src/ai/models/transcribe-input.ts`, `functions/src/ai/models/transcribe-result.ts`
- Modify: `functions/src/ai/schemas.ts` (`parseTranscribeInput`)
- Modify: `shared/contracts/functions/ai-ops.ts` (`'transcribeOrder'`), `functions/src/routing/ai.ts` (handler)
- Modify: `shared/contracts/ai/` (add `transcribe-input.ts`, `transcribe-result.ts`, export from index) — shared by web
- Modify: `functions/src/ai/errors.ts` (add `NO_SPEECH`, mapped to `failed-precondition` with `details.code`) and `shared/contracts/ai/ai-operational-code.ts` if codes are listed there
- Test: `tests/unit/ai-transcription.test.ts`, `tests/unit/function-router.test.ts`

**Interfaces:**
- Produces: `TranscribeInput = { salonId: string; audio: string; mimeType: string; language: 'pl' | 'en' }`, `TranscribeResult = { text: string }`; op `transcribeOrder` on the `ai` router.
- `createOrderTranscriber({ resolveActor, admitAiCall, transcribe })` where `transcribe(budget, { audio: Buffer, mimeType, language }): Promise<string>` is the provider seam (Genkit `ai.generate` with `prompt: [{ media: { url: 'data:<mime>;base64,<b64>', contentType: mime } }, { text: 'Transcribe.' }]`, `system: transcriptionInstruction(language)`, `config: { temperature: 0, maxOutputTokens: 512 }`, model from the existing replenishment config).
- Flow: parse → actor → SALON scope check (`FORBIDDEN`) → admission (`admitAiCall(actor, 'transcription', …)`, counts 1) → decode base64 → size check → provider within budget → trim → empty → `NO_SPEECH`; > 2000 chars → cut at 2000.

- [ ] **Step 1: Failing tests** (`ai-transcription.test.ts`, provider and admission faked):
  - rejects: missing auth → `unauthenticated`; salon user for a foreign salon → `permission-denied`; audio > 1 MB decoded → `invalid-argument`; `mimeType` `text/plain` → `invalid-argument`; `audio/mp4;codecs=mp4a.40.2` accepted; language `de` → `invalid-argument`.
  - admission called exactly once per accepted call and before the provider.
  - provider gets a Buffer equal to the decoded input and the instruction for the given language.
  - instruction text: contains rules for filler removal, digits, self-correction, commas, "keep product words exactly as heard", "never add products or quantities"; contains **no** product names from the seed catalog (assert none of `docs/not-bad-stuff-products.json` names appear).
  - whitespace-only provider text → `NO_SPEECH`; 2500-char text → 2000 chars.
  - no logger call contains the transcript text or base64 (spy on the logger).
  - router: `aiOps` includes `transcribeOrder`, handler exists.
- [ ] **Step 2:** `npx vitest run tests/unit/ai-transcription.test.ts tests/unit/function-router.test.ts` → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** tests → PASS; `npm --prefix functions run build`, `npm run typecheck`, `npm run test:unit` → pass.
- [ ] **Step 5:** commit `feat(ai): transcribeOrder op with cleaned no-catalog transcription`.

### Task 3: `matchProducts` turn and auto-match rules (functions)

**Files:**
- Create: `functions/src/ai/product-matching.ts` — `createProductMatcher(model?)` returning `matchProducts(budget, request: MatchRequest): Promise<MatchResult>`
- Create: `functions/src/ai/product-matching-rules.ts` — `applyMatches(lines, matches, catalog): AppliedMatch[]` (pure)
- Create: models `functions/src/ai/models/match-request.ts`, `match-result.ts`, `applied-match.ts`
- Modify: `functions/src/ai/replenishment.ts` (wire matcher between generation and `finalProposal`; receipts for AI-matched lines; `language` passthrough)
- Modify: `functions/src/ai/replenishment-tools.ts` (`finalProposal(items, applied?)`), keep ≤ 300 lines (split a helper file if needed)
- Modify: `functions/src/ai/schemas.ts` (`PrepareInput.language?: 'pl' | 'en'`)
- Modify: `shared/contracts/draft/ready-draft-line.ts` (`aiMatch?: AiMatch`), new `shared/contracts/draft/ai-match.ts`, `shared/contracts/draft/clarification-line.ts` (`candidates[].suggested?: true`, `candidates[].reason?: string`), `shared/contracts/ai/prepare-input.ts` (`language?`)
- Test: `tests/unit/product-matching.test.ts`, `tests/unit/product-matching-rules.test.ts`, extend `tests/unit/replenishment-agent.test.ts` (or the existing preparer test file)

**Interfaces:**
- `AiMatch = { originalWording: string; reason: string; alternatives: { productId: string; productName: string }[]; choiceReceiptId?: string }`.
- `MatchRequest = { language: 'pl' | 'en'; lines: { lineId: string; originalWording: string; productQuery: string; tier: LookupMatchTier; candidateIds: string[] }[]; catalog: { productId: string; name: string; type: string; category: string; keywords: string[]; aliases: string[]; salonShorthand: string[] }[] }`.
- `MatchResult = { lines: { lineId: string; productIds: string[]; confidence: 'HIGH' | 'LOW'; reason: string }[] }` (model output schema with `.describe()` on every field; ≤ 3 ids, reason ≤ 120).
- `applyMatches` rules (from Global Constraints): drop ids not in `catalog`, drop lineIds not requested; READY with `aiMatch` only when tier ∈ {`NONE`,`CONTAINS`}, exactly one id, `HIGH`, quantity present; `HIGH` without quantity → `ENTER_QUANTITY` clarification, AI product first and `suggested`; otherwise `CHOOSE_PRODUCT` with AI ids first (`suggested: true`, `reason`), then the remaining deterministic candidates (or the catalog for `NONE`), no duplicates.
- Preparer: lines with an explicit user choice in `input.clarifications` never go to the matcher; matcher not called when nothing is unresolved; matcher consumes 1 model turn from the shared budget; any matcher error/timeout → `applied = []` (today's result) and a log line with error code only.
- Receipts: AI-matched READY lines get a receipt in the same `shorthand.issue` batch (allowed ids = AI alternatives ∪ deterministic candidates, or catalog for `NONE`), stored in `aiMatch.choiceReceiptId`. A later explicit choice for that lineId teaches shorthand exactly as clarification choices do.

- [ ] **Step 1: Failing tests.**
  - rules: each branch above with a small fixture catalog; foreign id dropped; unrequested lineId dropped; quantity null + HIGH → `ENTER_QUANTITY`; ambiguous deterministic tier `TYPE` with 3 candidates + HIGH → clarification (not READY), AI first; duplicates removed; ≤ 3 suggestions.
  - matcher: builds the request with catalog card fields; output parsed with the schema; invalid output → throws `INVALID_MODEL_OUTPUT`.
  - preparer: no unresolved lines → matcher not called; matcher rejects → result deep-equals the no-matcher result; matcher hangs beyond the deadline → today's result; AI-matched READY line has `aiMatch.choiceReceiptId` from the receipt batch; an explicit choice for an AI-matched line in the next prepare call produces `shorthandLearning: LEARNED`; an untouched AI-matched line produces no learning entry; `language` reaches the matcher.
- [ ] **Step 2:** run the three test files → FAIL.
- [ ] **Step 3:** implement. Matcher prompt (owner: associate even when nothing matches 1:1; no hardcoded product examples in the prompt — the catalog card is the only product knowledge): "For each line, pick at most 3 catalog products the phrase most likely refers to. The phrase may be misheard, misspelled, inflected, shortened or a sound-alike of a product name or alias (e.g. a foreign brand written the way a Polish speaker hears it, missing or extra letters, wrong diacritics). Aliases and salon shorthand are hints, not an exhaustive list — match by similarity of sound and meaning even when no alias is equal. HIGH only when one product is clearly meant. Never invent products; return none when unsure. reason: one short sentence in <language>." Add a test that the prompt text contains no product names from `data/seed/business.json` (product knowledge must come from the request).
- [ ] **Step 4:** tests → PASS; `npm --prefix functions run build`, `npm run typecheck`, `npm run test:unit` → pass.
- [ ] **Step 5:** commit `feat(ai): Gemini product matching with labelled auto-match`.

### Task 4: Web data-access for transcription and language

**Files:**
- Modify: `web/src/app/core/assistant-api.ts` — `transcribeOrder(input: TranscribeInput): Promise<string>`; `prepareReplenishment` sends `language` from `Language.current()`; map `NO_SPEECH` into `AssistantErrorCode`
- Test: `web/src/app/core/assistant-api.spec.ts`

- [ ] **Step 1: Failing specs:** `transcribeOrder` calls `callFunction(firebase, 'transcribeOrder', input)` and returns `text`; `NO_SPEECH` error maps to code `NO_SPEECH`; `prepareReplenishment` input includes `language`.
- [ ] **Step 2:** `npm run test:web` → FAIL. **Step 3:** implement. **Step 4:** `npm run test:web`, `npm run typecheck` → pass.
- [ ] **Step 5:** commit `feat(web): assistant API for transcription and language`.

### Task 5: Recorder service and mic control

**Files:**
- Create: `web/src/app/core/voice-recorder.ts` (+ spec) — the only file touching `navigator.mediaDevices` / `MediaRecorder`
- Create: `web/src/app/features/replenishment/feature/dictation.facade.ts` (+ spec)
- Create: `web/src/app/features/replenishment/models/dictation-state.ts`
- Create: `web/src/app/features/replenishment/ui/dictation-button.ts` (+ spec)
- Modify: `web/src/app/features/replenishment/ui/assistant-input.ts` (render the button, receive text)
- Modify: `web/src/index.html` icon subset (`mic`, `stop` if not present — `tests/unit/icon-font.test.ts` enforces)
- Modify: `web/public/i18n/en.json`, `pl.json` (`replenishment.dictation.*`)

**Interfaces:**
- `VoiceRecorder` (`@Service()`): `supported(): boolean` (`MediaRecorder` + `getUserMedia` exist); `start(): Promise<void>` (mono, `audioBitsPerSecond: 64000`, mimeType first supported of `audio/mp4`, `audio/webm;codecs=opus`, `audio/webm`); `stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }>`; `level: Signal<number>` (0..1, optional analyser); throws `MicrophoneBlockedError` on `NotAllowedError`. Stops all tracks on stop/error.
- `DictationState = 'idle' | 'recording' | 'recognising' | 'error'`; `DictationFacade`: signals `state`, `elapsedMs`, `errorKey`; `toggle()`; auto-stop at 30 000 ms; on stop → base64 → `AssistantApi.transcribeOrder({ salonId, audio, mimeType, language })` → emits text via `onText(cb)` or a `text` output; keeps the last recording for `retry()`; on `visibilitychange` hidden while recording → stop and transcribe.
- Visibility: button shown only when `runtimeConfig.publicConfig.replenishmentAiEnabled` and `VoiceRecorder.supported()`.
- Append rule: textarea empty → text; else `existing + ', ' + text`; result capped at 2000 chars (the form's `maxLength`), and if capped show `replenishment.dictation.tooLong`.
- Copy (en / pl):
  - `start` "Dictate order" / "Podyktuj zamówienie"; `stop` "Stop recording" / "Zatrzymaj nagrywanie"; `recognising` "Recognising…" / "Rozpoznaję…"
  - `blocked` "Allow the microphone for BarberHQ in Settings" / "Zezwól BarberHQ na mikrofon w Ustawieniach"
  - `noSpeech` "Didn't catch an order, try again" / "Nie usłyszałem zamówienia, spróbuj jeszcze raz"
  - `failed` "Couldn't recognise speech" / "Nie udało się rozpoznać mowy"; `retry` "Try again" / "Spróbuj ponownie"
  - `tooLong` "The order text is at its length limit" / "Tekst zamówienia osiągnął limit długości"

- [ ] **Step 1: Failing specs** (fake `MediaRecorder` / `getUserMedia`, fake timers): unsupported → button hidden; tap → recording, elapsed ticks; tap again → recognising → text appended; 30 s → auto-stop; permission denied → error `blocked`, state back to usable; `NO_SPEECH` → `noSpeech`; provider failure → `failed` + retry re-sends the same recording; hidden tab while recording → stops and transcribes; append rule incl. 2000 cap; recorder releases tracks on stop and on error.
- [ ] **Step 2:** `npm run test:web` → FAIL. **Step 3:** implement. **Step 4:** `npm run test:web`, `npm run test:unit` (icon font), `npm run typecheck`, `npm run format:check` → pass.
- [ ] **Step 5:** commit `feat(web): dictate an order into the assistant input`.

### Task 6: AI-match label, change flow and suggestions in the UI

**Files:**
- Modify: `web/src/app/features/replenishment/ui/order-panel.html` / `order-panel.ts` (READY line with `aiMatch`: chip "Matched by AI" / "Dopasowane przez AI", tooltip/text with `reason`, button "Change" / "Zmień")
- Modify: `web/src/app/features/replenishment/ui/clarification-input.ts` (suggested candidates first with a "Suggested" / "Sugestia" marker and reason)
- Modify: `web/src/app/features/replenishment/feature/draft.store.ts` and/or `replenishment-assistant.facade.ts` ("Change" turns the READY line back into a choice using `aiMatch.alternatives` + catalog, carrying `aiMatch.choiceReceiptId` so the choice is sent like a clarification choice)
- Modify: i18n en + pl (`replenishment.order.aiMatch.*`)
- Test: specs next to each file

- [ ] **Step 1: Failing specs:** READY line with `aiMatch` shows the label and reason; "Change" opens the choice with alternatives first; picking a product sends a clarification choice with `choiceReceiptId` on the next prepare; untouched AI line submits as a normal READY line (no `aiMatch` sent to submit); clarification shows suggested candidates first with marker; lines without `aiMatch`/`suggested` render as today.
- [ ] **Step 2:** `npm run test:web` → FAIL. **Step 3:** implement. **Step 4:** `npm run test:web`, `npm run typecheck`, `npm run format:check` → pass.
- [ ] **Step 5:** commit `feat(web): show and change AI product matches`.

### Task 7: E2E, evaluation harness and docs

**Files:**
- Create: `tests/e2e/voice-order.spec.ts` (emulator mode; mock `**/ai` by op: `transcribeOrder` returns a fixed text, `prepareReplenishment` returns a result with one `aiMatch` line and one suggested clarification; fake microphone via Chromium `--use-fake-device-for-media-stream` / `--use-fake-ui-for-media-stream` launch args for this spec, or a stubbed recorder through an init script)
- Create: `scripts/dev/evaluate-dictation.ts` — reads `*.m4a`/`*.webm` + `keyboard.txt` from a folder given by `--dir`, calls the transcription provider and the prepare flow against the **emulator** (`demo-barberhq`) or prints the cleaned transcripts only with `--transcribe-only` using the owner's `gcloud` ADC against Vertex (read-only model calls, no data writes), writes a Markdown report to `--out`
- Modify: `docs/commands.md` (voice order: how it works, evaluation command, owner steps), `AGENTS.md` (Deployment: AI limit 20, `transcribeOrder` in `ai`, audio never stored), `docs/implementation/future-work.md` (STT fallback note)

- [ ] **Step 1: Failing e2e:** dictate → textarea contains the mocked text → Prepare → draft shows the "Matched by AI" chip and a suggested clarification; Change → choice → line updated.
- [ ] **Step 2:** run with emulators + `npm run dev:web`: `BARBERHQ_TEST_MODE=emulator npx playwright test tests/e2e/voice-order.spec.ts` → FAIL, implement fixes until PASS. Stop emulators (`npm run dev:stop`), revert generated `index.d.ts` noise.
- [ ] **Step 3:** evaluation script with a unit test of its report formatting (`tests/unit/evaluate-dictation.test.ts`, no network).
- [ ] **Step 4:** docs. Owner steps in order: `npm run deploy:db:diff` then `npm run deploy:db` (limit 20), `npm run deploy:functions`, `npm run build:prod` + `npm run deploy:preview`, iPhone test, promote after OK. Evaluation: put recordings + `keyboard.txt` in a folder, run `node --import tsx scripts/dev/evaluate-dictation.ts --dir <folder> --out <report.md> --transcribe-only`.
- [ ] **Step 5:** `npm run typecheck && npm run test:unit && npm run test:web && npm run format:check` → pass (format: only the two known pre-existing failures). Commit `docs: voice order runbook and evaluation harness`. Do not push.
