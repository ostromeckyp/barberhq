# Voice order and AI product matching — design

3 November 2026. Decisions marked "owner" were made by the owner in conversation; "assistant" marks the assistant's calls. Supersedes the "Dictation" section and the unbuilt "Turn 2" of `2026-10-24-product-knowledge-and-dictated-replenishment-design.md`.

## Why

On the iPhone PWA, keyboard dictation is poor for orders: brand names come out wrong, filler words and spoken numbers clutter the text, and the mic is buried in the keyboard. When a phrase does not match the catalog exactly, the salon today gets the whole catalog as a choice with no hint.

## Goals

1. **Voice order (owner):** a mic button in the replenishment assistant. The user speaks, the recording becomes a *cleaned* text in the message textarea, the user can edit it and taps "Prepare" as today.
2. **AI product matching (owner, option B):** when the deterministic lookup does not resolve a line, Gemini associates the phrase with catalog products using names, aliases and salon shorthand. A single high-confidence match goes straight into the draft, visibly labelled "matched by AI · change"; anything else becomes a clarification with AI suggestions first.

## Non-goals

- No Cloud Speech-to-Text (owner chose Gemini; STT stays a documented fallback, see Decisions).
- No live/streaming transcription, no audio storage, no voice for other screens (procedures assistant, HQ).
- No change to submit, approve, dispatch or stock rules; no change to the ≤ 6 lines batch rule or budgets beyond what is stated.

## Anti-goals

- A product the user never mentioned must never appear in the textarea. The transcript keeps product words as heard; only filler, numbers, self-corrections and punctuation are cleaned.
- An AI guess must never look like the user's own words: every AI-chosen product in the draft is labelled and changeable in one tap.
- A missing quantity never becomes 1 — not in the transcript, not in matching.
- A failing or slow AI step never blocks the order: transcription failure leaves the textarea as it was; matching failure falls back to today's clarifications.

## Decisions

### Transcription (owner: Gemini, no catalog, cleaned)

- Web: mic button next to the assistant textarea, shown when `replenishmentAiEnabled` is on and the browser has `MediaRecorder` and `getUserMedia`. Tap starts recording (red stop button, `m:ss / 0:30` timer, simple level indicator); tap again or 30 s ends it. Then "Recognising…" until the text arrives. The cleaned text is appended to the textarea (separated by ", " if the textarea is not empty) and focus moves to the textarea. The user then taps "Prepare".
- New `ai` op `transcribeOrder`, input `{ salonId: string, audio: string /* base64 */, mimeType: string, language: 'pl' | 'en' }`, output `{ text: string }`. Same auth, salon-access and App Check rules as `prepareReplenishment`; counts once against the existing AI admission/usage window. Owner: the hourly limit per user rises from 10 to 20 (`WHERE ai_usage_window.count < 20` in `dataconnect/server/ai/admission.gql`, plus any test or doc that pins 10); a voice order uses 2 calls. Deploying the changed server operation follows the usual `deploy:db:diff` / `deploy:db` with the owner's approval.
- `language` is the Transloco UI language; the prompt treats it as the expected language and still transcribes the language actually spoken (assistant).
- Recording at `audioBitsPerSecond: 64000` mono (assistant): 30 s ≈ 240 KB, ≈ 320 KB as base64, well inside the callable request limit; no Storage upload.
- Validation: decoded audio ≤ 1 MB, `mimeType` one of `audio/mp4`, `audio/aac`, `audio/x-m4a`, `audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/wav` (codec parameters allowed); otherwise `invalid-argument`.
- Model: the replenishment model (`gemini-3.5-flash-lite` on Vertex, existing config), audio as inline media plus a system instruction (assistant): transcribe what was said in the given language; remove filler words and hesitations; write numbers as digits; when the speaker corrects themselves keep only the correction; separate items with commas; keep every product word exactly as heard — never replace it with a brand or catalog name, never add products or quantities that were not said; output only the text. **No catalog in this call.** Low temperature, small `maxOutputTokens`, existing budget timeout.
- Result ≤ 2000 characters (the message limit). Empty result → error code `NO_SPEECH`.
- Audio is never written to Storage, the database or logs. Logs carry salonId, duration/size and error codes only, never the transcript.
- Errors in the UI (en + pl): microphone blocked ("Allow the microphone for BarberHQ in Settings"), `NO_SPEECH` ("Didn't catch an order, try again"), provider/network failure ("Couldn't recognise speech" + retry using the kept recording), AI limit reached (existing copy).
- Fallback (assistant): if the evaluation (first plan task) shows Gemini mishears Polish audio badly, the same op switches to Cloud Speech-to-Text V2 behind the same contract; the web does not change. That needs `speech.googleapis.com` and a role for `baberhq-runtime` with the owner's approval.

### AI product matching (owner: B)

- After turn 1 (extraction, unchanged) and the deterministic `findProduct`, collect lines that are not resolved: tier `NONE` or `CONTAINS`, or more than one candidate, and no explicit clarification choice from the user.
- If there are any, one more model turn (`matchProducts`) — inside the same `prepareReplenishment` call, sharing its budget (5 model turns, 8 tool calls, 25 s deadline) — gets: per line `lineId`, `originalWording`, `productQuery`, deterministic candidates; shared: the salon catalog card (productId, name, type, category, keywords, aliases including PHONETIC, the salon's confirmed shorthand). It returns per line up to 3 `productId`s ordered by likelihood, a `confidence: 'HIGH' | 'LOW'` and a short `reason` (≤ 120 chars, in the UI language: `prepareReplenishment` gains an optional `language: 'pl' | 'en'` input, default `en`, additive). It may return no candidates.
- The server drops any productId outside the salon's catalog and any result for a line it did not ask about. Quantities come only from turn 1.
- Outcome per line:
  - Auto-match rule (assistant, starting point; the evaluation may tighten it): only for lines whose deterministic tier is `NONE` or `CONTAINS`. Lines that are ambiguous between several exact deterministic matches (`SALON`/`NAME`/`PHONETIC`/`TYPE`, e.g. "olejki" with three oils) are a real choice and always stay clarifications, with the AI order applied. No per-draft cap.
  - exactly one valid candidate with `HIGH` and a quantity, on a `NONE`/`CONTAINS` line → a READY line with `origin: 'assistant'` and a new optional `aiMatch: { originalWording, reason, alternatives: {productId, productName}[] }`. The UI shows "matched by AI · change"; "change" opens the same choice UI as a clarification, AI suggestions first.
  - `HIGH` but no quantity → `ENTER_QUANTITY` clarification with the AI product first, labelled "suggested by AI".
  - otherwise → `CHOOSE_PRODUCT` clarification as today, candidates reordered so AI suggestions come first and are flagged `suggested: true`, then the rest.
- Learning (assistant): an AI auto-match does not teach salon shorthand. A user choice made through "change" or a clarification teaches it exactly as today (receipt-based). The receipt for an AI-matched READY line is issued at prepare time in the same `IssueReplenishmentChoiceReceipts` batch as clarification receipts (allowed products = AI alternatives plus deterministic candidates) and travels in `aiMatch.choiceReceiptId`. `aiMatch` is display/learning metadata only; the submit path ignores it.
- Budget: the extra turn uses the existing budget (today 1 of 5 model turns used). Any failure or timeout of `matchProducts` → today's result, logged, no error to the user.
- Turn 2 is skipped when every line is resolved; no extra cost for clean orders.

## Evaluation and rollout order (assistant)

- The pipeline is built against Gemini without waiting for recordings. The evaluation runs as soon as the owner supplies recordings; it can only tighten the prompt/auto-match rule or trigger the STT fallback (then a separate small change). STT is documented, not prepared.

## Constraints

- `AGENTS.md`: TDD, i18n parity (en + pl), 300-line logic files, one model per file, web layering (component → facade → data-access → core; microphone/MediaRecorder access lives in `core/`), no production write without the owner's approval for that step.
- `ai` keeps its current options (memory, timeout, `maxInstances: 5`, secrets); no new callable service.
- Contracts in `shared/contracts` change additively (`aiMatch`, `suggested`); old clients keep working.

## Left to the builder

- Exact mic button placement and recording UI within the shared UI rules; recording format per browser (`audio/mp4` on iOS, `audio/webm` elsewhere).
- Prompt wording within the rules above; where the catalog card is built (reuse the snapshot `findProduct` already reads).
- E2E: mock the `ai` ops by `op` as existing e2e does; microphone via Playwright fake media or a stubbed recorder.

## Proof

- Evaluation (first plan task): the owner's 5–8 iPhone recordings of demo orders, run through `transcribeOrder`'s prompt and through the full prepare flow. Report per recording: keyboard-dictation text (owner supplied), Gemini cleaned text, resulting draft lines (READY / AI-matched / clarification). Pass: no invented product or quantity in any transcript; brand words recognisable enough that matching resolves them. The report decides Gemini vs the STT fallback and tunes the HIGH rule.
- Unit (functions): `transcribeOrder` validation (size, mime, language, auth, admission); prompt contains no catalog; empty text → `NO_SPEECH`; matching: invalid ids dropped, HIGH single → READY with `aiMatch`, LOW or several → clarification with `suggested` first, missing quantity → `ENTER_QUANTITY`, failure → unchanged result, skipped when all lines resolved, no shorthand learned from auto-match.
- Web unit: recorder states (idle, recording, 30 s stop, recognising, error, blocked mic), text appended to the textarea, "matched by AI · change" label and change flow, suggestions first.
- Manual on preview: iPhone PWA and Android, dictate a demo order, edit, prepare, change an AI match.
