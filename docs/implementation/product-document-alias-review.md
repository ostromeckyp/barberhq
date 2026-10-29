# Product document links and alias review — local implementation

28 October 2026. Implements [increment 2](../superpowers/plans/2026-10-27-product-document-alias-review.md) of the [product knowledge design](../superpowers/specs/2026-10-24-product-knowledge-and-dictated-replenishment-design.md). Local only: no cloud migration, deployment, provider call, stock operation, reset, Git staging or commit.

## What HQ can do

The existing original PDF/page review now includes Product knowledge for product cards/catalogs:

1. Select a stored chunk and an exact UTF-16 passage; repeated text requires an explicit occurrence. Physical pages, chunk identities, geometry and 768-dimensional vectors remain intact.
2. Link a passage manually, suggest by a complete product code without a model call, or explicitly request a single-section model suggestion. Suggested links remain unconfirmed until HQ chooses and confirms a catalog product.
3. Generate aliases for one confirmed product at a time. Types, names, Polish phonetic forms and source facts come from scoped data. Generated aliases default to pending; HQ can edit/add/accept/reject manually after provider failures.
4. Save the full bounded draft and inspect distinct product counts before/after each accepted phrase. A card requires exactly one product; a catalog requires products or an explicit empty acknowledgement. Every unused passage and every proposal decision must be reviewed.
5. Accept product review, then publish the PDF. Acceptance alone activates nothing. Frozen publication carries the exact product hash/revision/catalog identity through the existing queue and worker.

Published sources are immutable. Use Replace PDF to enrich a subsequent ordinary version. SALON receives only authorized published PDF references, never draft links/proposals.

## Storage and transaction guarantees

- Additive Business/version knowledge revisions, nullable projected Product type/source, version-bound links/profiles/aliases and a separate idempotent operation journal. Existing CREATE/REVIEW payload hash pins remain unchanged; product review adds its own canonical identity.
- Every draft write rechecks HQ/business/extraction/review/catalog state. Pending PUBLISH blocks changes. One generation claim precedes the provider call; expired attempts use generation fencing so late results cannot overwrite a successor or reviewed manual work.
- Publication atomically moves the document pointer, activates only explicitly accepted rows, retires superseded source rows and recomputes type/collision projections. Withdrawal retires only that version's provenance. Identical supporting aliases from another current source survive.
- Product type follows the newest eligible approved non-null assertion by publication time/version ID. Withdrawing it falls back to a surviving assertion or null. Stored ACTIVE/ambiguous flags alone are not matching authority; source eligibility is checked separately.
- Native operations use one parameterized `_execute` with dependent data-modifying CTEs. Toolkit 3.4.21 produced invalid SELECT wrappers for multiple native fields and mixed native/GraphQL writes; isolated probes and rollback regressions support this compatibility choice.
- Old durable PDF-only product publish intents can finish only at product-review revision 0 with no product rows. Fresh product publication requires accepted product review before allocating a receipt. Procedure/policy publication and RAG eligibility remain compatible.

## Limits and model behavior

Original 25-second deadline, five model turns/eight tools maximum, shared ten admissions/user/UTC hour. Each explicit alias request uses one structured model call, maxTurns 1, no tools, 2048 output tokens, no automatic provider retry. The generation command counts snapshot, claim, fresh check and fenced persistence; pagination remains inside the original deadline.

Maximum 200 catalog products, 200 links/version, 32 aliases/product, 120 Unicode characters/phrase, 80/type, pl/en only, 16000 source characters/product and 64000 serialized catalog/active-alias characters. Catalog pages are 100; eligible global alias provenance pages 1000, maximum 5000 rows before deduplication. Overflow fails explicitly rather than truncating. A larger document can remain a PDF reference.

## Verification evidence

| Gate | Result |
| --- | --- |
| Root unit suite | 49 files / 298 tests passed |
| Angular suite | 41 files / 197 tests passed |
| Native PostgreSQL/pgvector SQL | 10 affected suites / 129 tests passed |
| Root typecheck / Functions build | Passed |
| Offline pinned GraphQL compiler | `errors: []` |
| Actual compiled isolated Functions package | Loaded; exactly old 6 plus save/suggest/generate/accept; 9 packaging tests passed |
| Deterministic model evaluation | 6 cases, 9 proposals, 9 impacts, zero cloud calls; provider quality unmeasured |

SQL suites include product drafts/generation/publication, document commands/worker/races, lifecycle/publication and RAG flow/retrieval. They cover source collisions, lost response/replay, concurrency/lease fencing, access revocation, stale extraction/catalog, replacement retirement, remaining-source type fallback and null after last-source withdrawal. A stale queued publication leaves aliases proposed and pointer/type unchanged. Existing PDF/chunk/vector identities and legacy hashes remain pinned.

Actual CUA acceptance used isolated SQL Connect 9499, native PostgreSQL17/pgvector 9598, Auth9198 and Angular4215. Memory Storage, deterministic model/vectors and inline queue surround the actual domain services, extraction and worker. This proves local integration; it does not prove live Storage, Cloud Tasks, App Check or provider quality.

- Uploaded a disposable card and the six-product CAT-001 catalog through the real form. Confirmed six exact nonoverlapping catalog ranges, requested six separate fixture generations, explicitly accepted twelve proposals and four unused source ranges, checked both original pages and published.
- Impact showed Pomady 1→3 products and Lekka Stylizacja 0→2. Withdrawing the card left twelve catalog aliases ACTIVE and retired only the card's two aliases.
- An independent SALON login saw only the published catalog; neither the withdrawn card nor a separate unpublished private draft appeared. The original PDF rendered.
- Desktop and 320px checks passed: document clientWidth equals scrollWidth at 320. [HQ sources](../../artifacts/product-document-alias-review-local/hq-sources.png), [mobile review](../../artifacts/product-document-alias-review-local/hq-review-320.png), [mobile impact](../../artifacts/product-document-alias-review-local/hq-impact-320.png), [salon PDF](../../artifacts/product-document-alias-review-local/salon-pdf-320.png).
- Component regression caught JSON object field-order differences incorrectly displaying saved unused ranges as unchecked; ordered passage tuple comparison fixes it, observed RED→GREEN. The product hash/key recovery test recreates the route with newer knowledge and verifies replay of the original frozen command.
- `tests/e2e/product-knowledge-review.spec.ts` records a local-only executable scenario in BDD style. Browser execution here used CUA; no additional Playwright CLI execution is claimed.

## Production-shaped build and rollout

Verification build uses the explicitly allowed public snapshot `artifacts/ui-refinements-2026-10-26-final/public-config.json`, project notbad-6be95, cloud browser SDK. Generated public configs and the previous build record are restored byte-for-byte, including prior absence. This build includes pre-existing compact-login changes that the owner explicitly left local: **not publication eligible** without an exact approved release scope. Frozen deployed artifacts remain intact.

Verified browser build: **85ff74e06bf6abc739f179f6f823af4e7567655df558174478b2570db668880f**, 67 public files. Initial bundle **552.07 kB** exceeds the 500 kB warning budget, below the 1 MB error limit. The first sandbox build exited without diagnostics; the successful repeat used two workers.

Before a later rollout:

1. Complete increment 1 classification migration/dependencies under its approved runbook and reconcile pending document operations. No existing published catalog gains aliases automatically.
2. Take the approved backup/export and preservation snapshots; deploy additive schema and compatible server connector with Product writer revision participation. Do not drop legacy fields or existing data.
3. Restage current Knowledge runtime (ten exports), SDK and frontend together. Preserve separate PDF source and procedure/replenishment function codebases. Drain or reconcile pending workers before replacing connector/runtime contracts.
4. Deploy only after approval, validate Auth/App Check, both roles, source PDF and real provider output on agreed fixtures. New product versions require a fresh full HQ review.
5. Before any new product knowledge is published, compatible rollback can retain empty additive tables/fields. After aliases/types become active, an old publisher/withdrawal worker cannot maintain their projections: keep the compatible backend or use an audited forward fix. Do not silently reactivate retired sources or remove source-bound records to fit old code.

## Boundary and remaining work

The existing replenishment matcher does **not yet consume these SQL aliases/types**. This increment does not fix the original empty-candidate issue by itself. The [increment 3 plan](../superpowers/plans/2026-10-28-alias-backed-replenishment-and-salon-shorthand.md), prepared for owner review, covers SQL-backed lookup, inflection and salon shorthand. Two-turn orchestration and dictation remain increment4. Paid model evaluation, cloud release, deferred demo acceptance and full translation remain separate.

Owner checkout/staging and this plan's local evidence workspace are retained. No dependency was installed or reinstalled.

## Independent final review and fix pass

One fresh-context reviewer found four Important issues, with no Critical or Minor findings. All four were reproduced and fixed in one pass:

- Waiting READ COMMITTED statements now compare a materialized snapshot business revision before publication/withdrawal projections. A deterministic native row-lock barrier test executes the exact production withdrawal SQL in two independent PostgreSQL sessions: previously both succeeded; now one commits, the other affects zero rows and succeeds only after a fresh whole-command retry. The SQL Connect emulator transport serializes operations, so it alone cannot expose this race. The barrier test requires the explicitly supplied owned local PostgreSQL URL; it ran, not skipped, in the129-case gate.
- Catalog-only conflicts preserve unsaved edits while refreshing their catalog base/impact. A competing draft/extraction change keeps local work and offers an enabled, explicitly labelled discard/reload action. No silent replacement or permanently stale disabled editor.
- Correcting/unconfirming links removes profiles without remaining confirmed support; profiles supported by another confirmed passage remain. The UI explains that effect.
- Both replacement entry points pass kind/origin/language/provenance to the shared dialog. The form prefills them, retains deliberate user changes, and the authorized browser query/mapper carries provenance. Component regressions cover public-compilation metadata; CUA confirmed Product catalog remains selected in the actual replacement dialog.

Six UI regressions and the native race were observed failing before their fixes. Full post-fix gates:298 root units,197 Angular tests,129 SQL cases; typecheck, Functions build and actual package load pass. Final verification browser hash: `85ff74e06bf6abc739f179f6f823af4e7567655df558174478b2570db668880f`. The initial552.07kB warning remains. No second review pass was dispatched; fixes are backed by these regressions and full suites.

CUA also tested unknown-outcome recovery after reload using a local transport fault proxy. First request was withheld with an unknown result; after reload, Retry same publication sent byte-identical JSON, including product review hash, then published through the real local service. `sameCommand=true`, `containsProductHash=true`. Committed-response/worker replay is additionally covered by SQL tests. The proxy retained only a body fingerprint, never auth values.

### Decisions retained

- Existing checkout and evidence workspace are preserved without commits/cleanup, as approved. Cost: this increment has no independent Git snapshot until the owner chooses one.
- Atomic native statements use a single parameterized CTE transaction due the pinned toolkit limitation. Cost: longer SQL requires continued isolated regression coverage.
- Real-provider quality remains a later paid gate; cost: semantic output quality is unmeasured.
- Cloud Auth/App Check/Tasks/Storage and rollout remain a later approved gate; cost: local evidence does not certify cloud integration.
- Matcher correction belongs to increment3; cost: the original empty-candidate issue remains until that increment.
- Scaling past explicit limits belongs to a later plan; cost: larger inputs receive an explicit limit error.
- Full translation and compact-login publication scope remain deferred; cost: mixed language and no release eligibility for that unrelated local delta.

These are the two execution rulings plus the five reviewer-deferred boundaries, each kept explicitly. No deferred Minor findings.

Controller-owned local services were stopped after acceptance; their disposable in-memory data is gone. Source, staging and verification evidence are retained.
