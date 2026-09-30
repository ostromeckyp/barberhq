# BarberHQ — Master Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved demo in small independently checked increments without loading the whole conversation into each task.

**Architecture:** Existing phase specifications remain requirement packages. The five approved increments cross those packages to prove real user workflows early; documents and AI are split into smaller plans. This index owns common interface decisions and coverage, while child plans own executable tasks.

**Tech Stack:** Angular/Material SPA, Firebase Auth/Hosting/Functions/Storage, SQL Connect/PostgreSQL/pgvector, Genkit/Gemini, TypeScript, npm, Vitest, Playwright, PDF.js.

**Spec:** [Approved delivery design](../specs/2026-09-29-barberhq-delivery-design.md), [master requirements](../../../.claude/specs/barberhq-master.md), [shared contracts](../../implementation/shared-contracts.md), [approved extensions](../../../.claude/specs/approved-design-extensions.md).

**Status:** Plans written for user review. The user invoked writing-plans after receiving the written design; this authorizes planning. No implementation method has been selected and no implementation/cloud action is performed by these files. Preserve `.claude/specs/` as explicitly requested.

## Global Constraints

- Business external key: `not-bad-stuff-demo`. Preserve the six `demoId` values in `docs/not-bad-stuff-products.json`.
- Integer units only; request quantities are 1–99. One shared multi-product UI draft creates one independent request per product.
- `available = onHand - reserved`. Conservation for this transfer: HQ + transit + Legnicka = 20.
- Limits across both AI endpoints: 2,000 input characters, 25-second flow budget, at most 5 model turns / 8 tool executions, 10 admitted requests per user per hour.
- Retrieve at most three eligible chunks; vector model/dimension is verified before creation, never assumed from an earlier example.
- PDF limits: 10 MiB and 30 pages per document. No OCR or PDF editing.
- No Firestore, SSR, App Hosting, Nx, second vector store, persistent chat, autonomous stock writes or ordinary staff reset UI.
- Public config is built into the SPA; backend/model credentials and private UID mappings never enter its output.
- English UI, one Angular Material M3 theme; preserve handoff tokens and domain components, not exported HTML runtime.
- Synthetic policy labels and public-product provenance are mandatory. Six real product records do not imply live inventory or official procedures.

## Review Focus

- Scheduling drift can omit original requirements: coverage matrix below and plan5 task3 require each acceptance item to have evidence.
- Shared contracts can diverge between independently executed tasks: types below, task Interfaces and compilation checks own this risk.
- A green mocked test can be mistaken for deployment proof: cloud transaction/source/retrieval checks remain mandatory in plans2–4.
- Late operations can expose a previous session or obsolete document: plan1 task3, plan4A task3 and plan4B task2 contain explicit checks.
- An executor can accidentally start the whole project: run only one selected plan/task and report its bounds; approval of plans is distinct from execution-method selection.

---

## Execution order and entry points

| Increment | Plan | Prerequisite evidence | Visible result |
|---|---|---|---|
| 1 | [Foundation](2026-09-29-barberhq-01-foundation.md) | Owner project for deployed checks; local work can begin independently | Sign-in and live salon stock on Hosting |
| 2 | [Manual replenishment](2026-09-29-barberhq-02-replenishment.md) | 1 | Two units move correctly; multi-product basket works |
| 3A | [One PDF path](2026-09-29-barberhq-03a-pdf-path.md) | 1/2 runtime; local PDF prep can begin earlier | A reviewed PDF opens at its actual highlighted passage |
| 3B | [Document library](2026-09-29-barberhq-03b-document-library.md) | 3A | Five-PDF corpus and HQ review/version lifecycle |
| AI-0 | [4A task1 only](2026-09-29-barberhq-04a-replenishment-agent.md) | Existing auth/functions/SQL and owner model access | Shared bounded AI runtime; implement once |
| 4A | [Replenishment agent](2026-09-29-barberhq-04a-replenishment-agent.md) | 2 and AI-0 | Natural language prepares existing basket |
| 4B | [Procedure RAG](2026-09-29-barberhq-04b-procedure-rag.md) | 3B and AI-0 | Grounded instructions and working citations |
| 5 | [Release and rehearsal](2026-09-29-barberhq-05-demo-release.md) | All required reports | Verified release and repeatable six-minute demo |

Preferred sequential execution: 1 → 2 → 3A → 3B → AI-0 → 4A → 4B → 5. 4B can precede4A after AI-0; neither flow depends on the other's implementation. This does not authorize subagent dispatch. No new Codex tasks/threads are created by planning.

Start a fresh execution context with this index, the selected child plan, the design's relevant increment, shared contracts and named prerequisite reports. Load only referenced sections of original phase specs/architecture/handoff, not every plan. The child plan’s Interfaces block and common types below travel with a delegated task.

## File and tool conventions

Use `web/` for Angular, `functions/` for backend, `dataconnect/` for schema/connectors, `scripts/` for operator/verification and `shared/contracts/` for browser-safe DTO types. This is one app and one small backend, not an Nx workspace or collection of services.

Independent package/lockfiles live at root (operator/test tooling), `web/` and `functions/`; clean install each when introduced. DTOs in `shared/contracts/` contain no secrets or server imports. Functions compilation must include any emitted shared modules inside its deployable source directory: with TypeScript `rootDir: '..'` and output under `functions/lib/`, set package main to the actual emitted entry and prove the artifact works without sibling source directories. Do not depend on a local external package that Firebase will not upload.

Generated SDK destinations: browser in `web/src/app/core/generated/`, Functions in `functions/src/generated/`, operator in `scripts/generated/`. Never hand-edit generated files. Configure service/connector IDs from owner settings, regenerate and compile whenever operations change. Operation names in these documents are app contracts, not guessed generated SDK method names.

Runtime/package versions are not installed or pinned by planning. Task1 verifies currently supported Angular/CLI/Material and compatible Node/TypeScript, then locks them. Functions may require a different supported Node runtime. PDF/provider compatibility is verified at their introducing tasks. Record actual versions instead of copying stale numbers.

During initial implementation, add ignore rules, inspect the workspace, initialize Git if still absent, and make an explicit reviewed initial commit. Do not indiscriminately commit local settings or handoff assets. Subsequent task commits stage only relevant files; commit failure is reported, not fabricated. No Git initialization happens during this planning step.

### Command contract (to be implemented, not existing commands)

| Command from repository root | Implementation owner / expected behavior |
|---|---|
| `npm run test:unit -- PATH...` | 1.1 establishes Vitest run over named root/function/script tests; unit fixtures never reach cloud |
| `npm run test:integration -- PATH...` | 1.2 establishes separate Vitest config and explicit local cloud-target record; missing credentials/target fails with a blocker, never silently skips |
| `npm run test:web -- PATH...` | 1.1 creates `scripts/checks/web-test.mjs`, maps paths to the pinned Angular CLI test runner's include/filter flags and disables watch |
| `npm run test:e2e -- PATH...` | 1.1 establishes Playwright; 1.3 configures local ignored credential/base-URL fixture input; no hardcoded passwords |
| `npm run prepare:data` | 1.1 creates validated deterministic business fixtures |
| `npm run seed -- --dry-run` / `npm run seed -- --apply` | 1.2 uses explicit project/business/UID mapping from ignored local setup; prints target and checks it before writes |
| `npm --prefix web run build:production` | 1.4 validates public config then builds browser artifact |
| `npm run check:hosting -- --base-url URL` | 1.4 validates HTTP routes/headers and selected build's published file list |
| `npm run demo:reset -- --dry-run` / `npm run demo:reset -- --confirm-business not-bad-stuff-demo` | 2.4 implements scoped reset; local record selects target explicitly |
| `npm run prepare:pdfs -- --document DAM-001 --version v1` | 3A.1 invokes pinned local PDF exporter; 3B.1 adds full manifest mode |
| `npm run check:embedding` | 3A.3 verifies real document/query calls, model/config identity and dimension |
| `npm run ingest -- stage\|extract\|review\|publish` | 3A.3 implements explicit operator commands; command options carry manifest/version/hash/review-file/expected revision as applicable |
| `npm run eval:replenishment` | 4A.2 real-model evaluations with database no-write checks |
| `npm run eval:rag:calibrate` / `npm run eval:rag` | 4B.1 calibration/evaluation; raw outputs local/ignored, redacted evidence in handoff |
| `npm run check:release -- --base-url URL` | 5.2 validates configured target/version/build identity |

Where plans say `h`, it is a fixture helper defined in that task’s test support, not a production API. Root harness `tests/support/cloud.ts` (created1.2) exports `createCloudHarness(testName:string):Promise<CloudHarness>`. It validates the explicit demo project, uses operator identity only to set up isolated test records, returns real authenticated role clients, and implements only methods required by the current task. Its typed interface is extended alongside each new test. `dispose():Promise<void>` deletes only IDs the harness created; never reset the stage dataset as generic test teardown.

All root snippets use Vitest `expect`; browser snippets use Playwright `expect`. Test code blocks show assertions and exact values; the named test file owns imports/fixtures/setup. A missing command/runner is not a meaningful red test. Establish the runner, then demonstrate that the target behavior fails before implementing it. Release/manual visual checks record the unmet requirement instead of intentionally breaking a deployed service to manufacture a red result.

Use mocked delays/errors for focused UI state tests, real generated operations for authorization/concurrency, and real models for recorded evaluation. Clearly label each evidence source. Run the targeted checks once after meaningful changes; repeat/broaden only when needed.

## Common interfaces and type ownership

These are planned DTOs/adapters, not claims of existing code. Owners create them in the task named below; later tasks import rather than redefine. IDs are opaque strings, timestamps ISO8601 UTC, quantities/versions integers. Functions runtime input schemas validate strict objects and bounds; TypeScript alone is not validation.

### Business DTOs — 1.1/1.2, `shared/contracts/business.ts`

```ts
type PageInput = {limit:number;offset:number}; // default50, max50, nonnegative offset
type Page<T> = {items:T[];nextOffset:number|null};
type Membership = {userId:string;businessId:string;role:'HQ'|'SALON';salonIds:string[]};
type SessionState =
 | {status:'LOADING'|'SIGNED_OUT'|'NO_ACCESS'|'ERROR'}
 | {status:'READY';membership:Membership};
type Product = {
 id:string;demoId:string;name:string;brand:string;category:string;summaryEn:string;scentPl:string|null;
 sourceCode:string;netContent:{value:number;unit:'ml'};
 retailPriceGrosz:number;sourceUrl:string;observedOn:string;
 transferPackSize:null;packageDimensionsMm:null;shippingWeightGrams:null;
};
type Location = {id:string;key:'hq'|'legnicka'|'lodzka'|'zakladowa';name:string;kind:'HQ'|'SALON'};
type InventoryRow = {
 productId:string;demoId:string;productName:string;netContent:{value:number;unit:'ml'};
 salonId:string;salonOnHand:number;salonInventoryVersion:number;
 hqOnHand:number;hqReserved:number;hqAvailable:number;hqInventoryVersion:number;
};
type BusinessSeed = {
 businessKey:'not-bad-stuff-demo';products:Product[];locations:Location[];
 inventory:{locationKey:Location['key'];productDemoId:string;onHand:number;reserved:0}[];
};
```

`CatalogSnapshot` is the validated input shape of the checked-in JSON, preserving its fields including `displayedRetailPrice.amount` and nullable physical metadata. `buildSeed` maps it to `BusinessSeed`, with stable IDs recorded by the seed tool. Integer money is retail PLN grosz, not transfer pricing. The initial fixture default is explicitly synthetic: HQ18 and each salon2 for each of six products, giving24 rows. Real cloud UIDs are loaded separately, never hardcoded.

`PublicConfig` (1.1 in `scripts/config/public-config.ts`, exported type usable by web) contains `projectId`, Firebase web config, `functionsRegion`, `dataConnect:{serviceId,location,browserConnectorId}`, `hostingSiteId`, `appCheck:{siteKey}`, `lowStockThreshold:2`, optional `pdfReadUrl`/`pdfUploadUrl`, and booleans `replenishmentEnabled`, `knowledgeEnabled`, `replenishmentAiEnabled`, `ragEnabled`. Firebase config projectId must match selected project. Endpoints are required when knowledgeEnabled; AI flags require their parent feature. Flags hide unfinished features, never grant authority. Private debug tokens are local only. Build script emits only allowlisted public fields.

Scoped read adapters expose `GetMyMembership → Membership|null`, `ListProducts(PageInput) → Page<Product>`, `GetSalonInventory(salonId,PageInput) → Page<InventoryRow>`. UI `getInventory` collects bounded pages for the tiny catalog; later lists keep pagination explicit.

### Stock and draft DTOs — 2.1/2.2

In `shared/contracts/stock.ts`:

```ts
type RequestState = 'PENDING_APPROVAL'|'RESERVED'|'DISPATCHED'|'RECEIVED'|'REJECTED';
type SubmitInput = {salonId:string;productId:string;quantity:number;idempotencyKey:string};
type TransitionInput = {requestId:string;expectedRevision:number;idempotencyKey:string};
type ApproveInput = TransitionInput & {expectedHqInventoryVersion:number};
type RejectInput = TransitionInput & {reason:string}; // trimmed1–500 characters
type ReceiveInput = TransitionInput & {receivedQuantity:number;allIntact:true};
type StockAction =
 | {type:'SUBMIT';input:SubmitInput} | {type:'APPROVE';input:ApproveInput}
 | {type:'REJECT';input:RejectInput} | {type:'DISPATCH';input:TransitionInput}
 | {type:'RECEIVE';input:ReceiveInput};
type CommandResult = {actionReceiptId:string;requestId:string;state:RequestState;revision:number;replayed:boolean};
type RequestSummary = {id:string;salonId:string;productId:string;productName:string;quantity:number;state:RequestState;revision:number;createdAt:string};
type RequestDetail = RequestSummary & {
 dispatchedQuantity:number;receivedQuantity:number;hqInventoryVersion:number;
 timeline:{state:RequestState;at:string;actorLabel:string;reason?:string}[];
 stock:InventoryRow;
};
```

`ActorContext` in `functions/src/auth/context.ts` is `{uid:string;businessId:string;role:'HQ'|'SALON';salonIds:string[]}`; it is derived from validated identity/SQL membership. Operator pipeline context is an explicit separate internal trusted context whose business scope is validated; do not assign fake staff identity to cloud tooling. Scope and permission are rechecked inside transactional operations.

Application domain codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `STALE_STATE`, `INSUFFICIENT_STOCK`, `INVALID_TRANSITION`, `IDEMPOTENCY_CONFLICT`, `ALREADY_ACTIVE`, `NOT_FOUND`. `ALREADY_ACTIVE` carries existing requestId; submission maps it to a row outcome. Firebase transport codes map to these in structured `details.code`, with a browser adapter normalizing `{code,message,requestId?}`. Unknown transport outcome is not a definitive domain failure.

In `shared/contracts/draft.ts`:

```ts
type LineOrigin = 'manual'|'assistant';
type ReadyDraftLine = {
 status:'READY';lineId:string;productId:string;productName:string;quantity:number;origin:LineOrigin;
 hqAvailable:number;salonOnHand:number;hqInventoryVersion:number;salonInventoryVersion:number;
};
type ClarificationLine = {
 status:'NEEDS_CLARIFICATION';lineId:string;originalWording:string;reason:string;origin:LineOrigin;
 candidates:{productId:string;productName:string}[];quantity?:number;
};
type DraftLine = ReadyDraftLine|ClarificationLine;
type SubmissionRow = {
 lineId:string;payload:SubmitInput;status:'CREATED'|'ALREADY_ACTIVE'|'FAILED'|'UNKNOWN';
 requestId?:string;errorCode?:string;
};
type PendingSubmission = {
 userId:string;businessId:string;salonId:string;
 rows:{lineId:string;payload:SubmitInput;status:'UNSENT'|'UNKNOWN'}[];
};
```

Editable ready rows can temporarily contain invalid quantities such as100; runtime validity controls submit. Conditional projection equals salonOnHand+quantity and is labeled “after full receipt”; it never alters Inventory. Pending records include unsent rows only after explicit batch submission has frozen their payloads. Confirmed rows are removed from pending storage; result links remain in UI memory. A restored pending record is validated and bound to the same authenticated user/business/salon.

### Knowledge DTOs — 3A.2, extended3B.2

In `shared/contracts/knowledge.ts`:

```ts
type PdfRect = {xMin:number;yMin:number;xMax:number;yMax:number};
type GeometryStatus = 'VERIFIED'|'UNAVAILABLE';
type ProcessingStatus = 'STAGED'|'EXTRACTED'|'REVIEWED'|'EMBEDDED'|'READY'|'NEEDS_REVIEW'|'FAILED';
type PdfPageGeometry = {viewBox:[number,number,number,number];userUnit:number;rotation:number};
type ExtractedPage = PdfPageGeometry & {
 physicalPage:number;text:string;markdown:string;
 spans:{start:number;end:number;rect:PdfRect}[];
 quality:'COMPLETE'|'NEEDS_REVIEW';
};
type ExtractedDocument = {title:string;pages:ExtractedPage[];quality:'COMPLETE'|'NEEDS_REVIEW';parserVersion:string;extractionHash:string};
type KnowledgeChunkDraft = {page:number;ordinal:number;sectionId:string;heading:string;text:string;start:number;end:number;rects:PdfRect[];geometryStatus:GeometryStatus};
type ProcessingResult = {versionId:string;status:ProcessingStatus;retryable:boolean;errorCode?:string};
type VersionStatus = ProcessingResult & {documentId:string;documentRevision:number;versionRevision:number;revokedAt:string|null};
type DocumentSource = {
 businessId:string;documentId:string;versionId:string;version:string;title:string;language:string;
 synthetic:boolean;sourceType:'synthetic-procedure'|'public-product-summary';superseded:boolean;
};
type SourceSection = DocumentSource & {
 chunkId:string;sourceSectionId:string;sectionId:string;physicalPage:number;excerpt:string;
 geometry:PdfPageGeometry;rects:PdfRect[];geometryStatus:GeometryStatus;
};
type DocumentRow = DocumentSource & VersionStatus & {pageCount:number|null;createdAt:string};
type KnowledgeReview = {
 version:DocumentRow;extractionHash:string;
 pages:(ExtractedPage & {reviewed:boolean})[];publicationAllowed:boolean;
};
```

`GetSourceSection` accepts versionId plus optional chunkId and returns authorized document metadata with nullable chunk fields; the Angular adapter exposes typed with-chunk and document-only overloads. A supplied invalid/foreign chunk is an error, never silently a document-only result. `sourceSectionId === chunkId`; `sectionId` is the logical heading grouping. Coordinates are unrotated PDF user space and physicalPage is1-based. The server constructs all citation metadata. Vectors, bucket paths and object generation are not browser DTO fields.

`ManifestEntry` uses the exact fields in shared contracts: documentId, version, title, language, businessKey, sourceType, synthetic, publicationStatus (`demo-current|retired`), inputPdf, sha256, sourceUrls:string[], observedOn:string|null. Source procedures use null observedOn unless an actual authoring date is separately tracked; product compilation uses the catalog observation date. No private credential fields.

Document inputs created3B.2:

```ts
type CreateDocumentInput = {
 title:string;language:'en'|'pl';sourceType:'synthetic-procedure'|'public-product-summary';
 sourceUrls:string[];observedOn:string|null;sha256:string;idempotencyKey:string;
 documentId?:string;expectedDocumentRevision?:number;
};
type ReviewDocumentInput = {
 versionId:string;extractionHash:string;reviewedPhysicalPages:number[];
 expectedDocumentRevision:number;idempotencyKey:string;
};
type RetryDocumentInput = {versionId:string;sha256:string;idempotencyKey:string};
type DeleteVersionInput = {versionId:string;expectedDocumentRevision:number;expectedVersionRevision:number;idempotencyKey:string};
```

Reject client-supplied business/actor/synthetic authority fields; derive scope and mandatory synthetic status from source type. Existing-document uploads require expected revision. Version IDs/numbers are server-assigned. Enforce nonempty title≤200, SHA256 hex64, reviewed page integers1..pageCount and source URLs as metadata only (never fetch arbitrary URLs). Domain errors add `VERSION_CONFLICT`, `INVALID_PDF`, `REVIEW_REQUIRED`, `SOURCE_REVOKED`, `PROCESSING_FAILED`; normalize as stock errors. Retries use same operation key/payload for uncertainty; a later deliberate new processing attempt may use a new operation key against the same registered version/hash.

### AI DTOs — AI-0 and owning flow tasks, `shared/contracts/ai.ts`

```ts
type PrepareInput = {
 salonId:string;message:string;
 clarifications?:{lineId:string;originalWording:string;productId?:string;quantity?:number}[];
};
type ProposalResult = {
 status:'PROPOSAL'|'NEEDS_CLARIFICATION'|'UNAVAILABLE';lines:DraftLine[];
 excluded:{lineId:string;productId:string;requestId:string;reason:'ALREADY_ACTIVE'}[];
 toolEvents:{name:'findProduct'|'getStockContext'|'calculateProposal';durationMs:number}[];
};
type ProductMatch = {query:string;candidates:{productId:string;productName:string}[]};
type StockContext = {
 productId:string;productName:string;hqAvailable:number;salonOnHand:number;
 hqInventoryVersion:number;salonInventoryVersion:number;activeRequestId:string|null;
};
type ProcedureInput = {question:string;answerLanguage:'en'|'pl'};
type CitedStep = {text:string;sourceSectionIds:string[]};
type ProcedureResult =
 | {status:'ANSWER';steps:CitedStep[];sources:SourceSection[];missingInformation:string[]}
 | {status:'NEEDS_CLARIFICATION';question:string;sources:[]}
 | {status:'INSUFFICIENT_EVIDENCE';message:string;sources:[]};
```

Operational errors use codes `RATE_LIMITED`, `TIMEOUT`, `PROVIDER_UNAVAILABLE`, `SOURCE_CHANGED`, `INVALID_MODEL_OUTPUT`, `EMBEDDING_CONFIG_MISMATCH`, distinct from no evidence. Flow-ready lines have origin assistant and server-derived quantities/stock; model tool payloads never supply trusted scope. Clarification carries originalWording so a stateless retry can match a line without relying on the model regenerating random IDs. Selected fields remain untrusted user input and are validated against the original message/catalog. Optional activity is actual tool events, not chain-of-thought. Known unsupported language is a validated input error until its evaluation passes; do not silently answer in an untested language.

## Owner setup checkpoints

1. Before1.2/1.4 cloud checks: owner creates/selects demo project/billing, compatible location, web app, email/password users, Data Connect service, Hosting and applicable App Check configuration. Agent prepares exact instructions/config files and scoped schemas. Keep UI/account choices with the owner; do not manufacture IDs.
2. Before3A.3: private bucket, runtime/operator access, embedding provider/model/location verified. Record bucket exactly and test real vectors before compiling dimension.
3. Before3B.2: enqueue/invoke IAM, Cloud Tasks worker limits and allowed HTTP origins recorded.
4. BeforeAI-0: reasoning model access verified; shared limits compiled/deployed.
5. Before5.2: exact preview/live domains/origins, backend compatibility and release identities verified.

[Presenter guide](../../06-firebase-setup-guide.md) remains the detailed reference. Configuration missing at execution blocks dependent cloud proof only; complete independent local tasks and report the exact missing prerequisite. Billing alerts are not a spending cap. Planning does not create billable resources.

## Acceptance coverage map

AC numbering is the current checkbox order in each original phase spec. R numbering is its numbered Requirements list. Each mapping identifies implementation and proof owners; final5.3 records actual evidence for each individual item.

| Requirement package | Implementation/proof owners |
|---|---|
| [P1](../../../.claude/specs/phase-01-data-and-pdfs.md) AC1 / R1–3 | 1.1–1.2 catalog/fixtures,2.4 reset preservation |
| P1 AC2–5 / R4–8 | 3A.1–2 export/review/geometry;3B.1 full corpus/replacement |
| [P2](../../../.claude/specs/phase-02-firebase-graphql-backend.md) AC1 / R1–2 | 1.2 scoped business schema/reads;3A.3–4 knowledge/vector/source;3B.2–3 library permissions |
| P2 AC2–4 / R3–5 | 2.1 deployed transaction/concurrency/role/replay proof |
| P2 AC5 / R6–7 | 3A.4 source access;3B.2 worker/commands/races |
| P2 AC6 / R8 | 1.1 ignore/config;3A.3 actual model/dimension;AI-0 limits/config; all handoffs |
| [P3](../../../.claude/specs/phase-03-seed-and-ingest.md) AC1 / R1 | 1.2 nonresetting seed;2.4 guarded reset |
| P3 AC2–3 / R2–6 | 3A.1–4 original/text/geometry/review/embedding;3B.1 full corpus |
| P3 AC4–6 / R7–8 | 3B.2–4 retry/publication/access;4B.1 filtered retrieval |
| [P4](../../../.claude/specs/phase-04-angular-app.md) AC1–2 | 1.3–4 build/UI/Hosting;5.1 full UI coverage |
| P4 AC3–5 | 2.1–3 lifecycle/access/stale-state/manual behavior |
| P4 AC6 | 3A.4 highlighted source/viewer |
| P4 AC7 | 2.2 independent batch and lost-response reconciliation |
| P4 AC8 | 3B.2–3 HQ upload/review/version controls |
| P4 AC9 | 2.3 low stock;5.1 responsive/keyboard review |
| [P5](../../../.claude/specs/phase-05-replenishment-agent.md) AC1–5 / R1–6 | AI-0 and4A.2–3 full agent/evaluation/manual fallback |
| [P6](../../../.claude/specs/phase-06-rag.md) AC1–7 / R1–7 | 4B.1 retrieval;4B.2 grounding/recheck/no-write;4B.3 human evaluation and viewer |
| [P7](../../../.claude/specs/phase-07-demo-readiness.md) AC1–6 | 5.1 UI;5.2 release/rollback;5.3 reset/repeat/timing/report |
| [Extensions](../../../.claude/specs/approved-design-extensions.md) E1–2 | 2.2–3 manual basket +4A.2–3 AI basket |
| Extensions E3–5 | 3B.2–4 access/retry/replacement/withdrawal +4B.2 recheck |
| Extensions E6 | 2.3 low-stock2→4 |
| Extensions E7 | 3A.2/4 extraction transforms and real viewer;4B.3 real citations |
| Extensions E8 | 2.1 golden totals;4B.2 no-write;5.3 six-minute rehearsal |
| [Hosting](../../../.claude/specs/firebase-hosting-deployment.md) H1–2 | 1.1/4 config/build/artifact checks |
| Hosting H3–4 | 1.4 routes;3B.4 document endpoints;5.2 full preview/live scope/App Check/origins |
| Hosting H5–7 | 5.2 same-version promotion/rollback;5.3 both scenarios on live |

All original numbered requirements remain binding even where grouped above; final coverage expands groups into individual checkbox rows. Extra plan-level details (rejection reason limit, demo fixture defaults, processing retry/concurrency defaults) are implementation choices for the user to review, not claims about existing software or real company policy.

## Handoff and execution choice

Each child plan writes `docs/implementation/handoffs/increment-<id>.md` (`3a`, `3b`, `4a`, `4b` lowercase). AI-0 writes `ai-foundation.md`. Include status READY/BLOCKED, implemented files/interfaces, actual versions, public configuration, checks with commands/outcomes, counts/hashes, original criterion coverage, known limitations and the next small context pack. Do not include secrets or say a whole original phase passed based on a partial increment.

Plans are ready for review, not execution. Recommend **Native** for the first increment: its setup/schema/login steps closely share evolving interfaces and one executor can keep that context cheaply, followed by independent review as required by the selected execution skill. **Subagent-driven** is available if the user prefers a separate implementer/reviewer per task, at higher context cost. The user must review the plans and choose the execution method before code/provisioning begins. Codex is the executor in either case; this choice is not Claude versus Codex.

## Documentation checks and external references

Self-review covers requirement mapping, task boundaries, shared types, meaningful tests, dependencies and local links. Test commands, generated APIs, package compatibility and deployments remain to be proven during execution. No application tests ran while producing these plans.

Self-review completed: eight plan documents, 25 tasks and 125 checkable steps. Structural verification covered 12 changed Markdown files and 103 local links with no broken links or unfinished placeholders. Manual review corrected source lookup typing, foreign-scope testing, product-specific low-stock assertions, stateless clarification, publication-race error expectations and recorded fallback coverage. No implementation or cloud checks are claimed.

Official references checked during planning:

- [Angular compatibility](https://angular.dev/reference/versions): use its compatibility matrix when pinning the build toolchain in1.1.
- [SQL Connect web SDK](https://firebase.google.com/docs/sql-connect/web-sdk): generated reads underpin the browser adapter.
- [SQL Connect mutations](https://firebase.google.com/docs/sql-connect/mutations-guide): compile and prove the specific transactional operations in2.1.
- [SQL Connect vector search](https://firebase.google.com/docs/sql-connect/solutions-vector-similarity-search): verify supplied-vector search/filtering and actual model configuration in3A/4B.
- [PDF.js examples](https://mozilla.github.io/pdf.js/examples/): viewport transforms underpin page rendering; actual extraction-to-highlight alignment still requires visual proof.
- [Task queue functions](https://firebase.google.com/docs/functions/task-functions): implement and verify queue retries/concurrency in3B.
- [Genkit tool calling](https://genkit.dev/docs/js/tool-calling/): bounded read tools underpin4A; enforce the app’s own budgets.
- [Hosting release management](https://firebase.google.com/docs/hosting/manage-hosting-resources): record and verify actual release/rollback behavior in5.2.
