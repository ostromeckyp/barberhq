# Knowledge kind and origin — local implementation

27 October 2026. Approved plan: [increment1](../superpowers/plans/2026-10-27-knowledge-kind-origin.md). This is a locally verified implementation. No cloud deployment, migration apply, cloud identity creation, reset or stock operation was performed for this increment.

## Implemented

- Independent document kinds: procedure, policy, product card, product catalog. Independent origins: official, public compilation, synthetic. All12 combinations are supported. Public compilation requires1–10 HTTP(S) provenance URLs and an observation date.
- Nullable SQL classification columns support expansion. New registrations and ingestion populate canonical metadata, derive synthetic and retain the exact legacy projection only where representable.
- Strict compatibility adapter rejects partial/unknown or contradictory storage metadata. Original legacy CREATE payloads, keys and hashes remain replayable; new provenance validation runs after replay lookup. The pinned pre-upgrade hash remains `2b15679262e07f5ed045cc25add21686fd8e6ca4cc70a1643b8de52311b192d1`.
- Upload form has separate kind/origin controls. Recovery keeps the exact original registration body; changing visible form values cannot replace an unresolved operation. Library/review/source/PDF labels use canonical provenance.
- Procedure retrieval includes all4 kinds. Internal SQL kind filtering precedes ranking/LIMIT3. Final citation recheck verifies scope/publication/config plus resolved kind/origin/synthetic equality, preventing stale provenance after a concurrent metadata change.
- Repeatable migration scans all version states and cursor pages, validates the whole scan before writing and stops on CAS conflict. Only kind/origin are updated. A report includes row identity and before/after SHA-256 preservation fingerprints over full version/document/page/chunk/vector/operation snapshots.
- Knowledge Functions packaging includes the shared runtime helper and relocates its imports. No new function export is added.

## Verification

- Root unit suite:47 files /276 tests passed.
- Angular suite:39 files /183 tests passed.
- Root typecheck and Functions build passed.
- Native SQL regression:7 suites /92 tests passed, including the additional provenance-race case.
- Metadata SQL proof includes205 versions across processing/publication/withdrawal states, idempotent repeat, stale CAS rejection, preserved original bytes and exact inventory7 on hand /2 reserved /version4. Stored page/chunk/vector/audit data are included in preservation fingerprints. Five initial PDFs and their hashes remain unchanged; the separate replacement manifest also uses canonical metadata.
- CUA tested HQ registration, actual PDF extraction, physical-page review and local publication for product-card/synthetic and policy/official. Before policy publication, SALON saw only the published card. PDF source labels were correct. At320px, dialog client/scroll widths were288/288 and library273/273; desktop and mobile screenshots are retained in the plan workspace.
- UI fixture used isolated SQL Connect9499, native PostgreSQL17/pgvector9598 and Auth9198; memory Storage, deterministic vectors and a local HTTP adapter around actual domain services/workers. This proves UI/domain integration; it does not claim live Storage, Cloud Tasks, App Check or provider acceptance.
- PGlite failed with its previously documented transaction/protocol issue. Native PostgreSQL is the acceptance target. The pinned CLI compile with explicit demo project attempted a deployed-schema read and returned403; offline toolkit compilation, SDK generation and isolated emulator compilation are used instead. No cloud permission was expanded.
- Focused browser test is saved in `tests/e2e/knowledge-metadata.spec.ts`; browser execution in this increment used CUA, not a Playwright shell run. Remaining old demo acceptance groups stay deferred by owner decision.

Controller-owned temporary services were stopped after verification; the owner’s existing emulator was not reset or stopped.

Evidence: `.superpowers/sdd/2026-10-27-knowledge-kind-origin/` contains RED/GREEN logs, task ledger, baseline-relative review diff, SQL runs and UI screenshots. Independent final review found one P2: manifest ingestion only checked provenance presence. Fixed by sharing the complete URL/count/collection/date validator with the callable parser before Storage allocation. The actual ingestion regression failed before the fix, then passed; all276 root,183 Angular and92 SQL tests passed afterward. No other actionable review findings remain. Actual compiled package discovery passed with exactly the original6 exports, using existing local dependencies and the staged SDK. Verification build:67 files, SHA-256 `ebb49846122afe1dd7215727bd9b146e2918e9ea72f5f43b417fd8d87735b173`, project/site `notbad-6be95`, production configuration. Build passed with the existing initial-bundle warning:551.79kB exceeds the500kB warning threshold; below the1MB error threshold. Generated public configuration and prior build record were restored. Offline GraphQL compilation returned no errors.

## Cloud migration commands — not executed

Only after approved quiet window, reconciled pending/unknown registrations and drained workers, deploy the additive schema and compatible server connector/backend. Restage from current source; existing frozen artifacts are not this increment's release package. Back up/export the current cloud state through the approved runbook before applying.

Dry-run:

```sh
node --import tsx scripts/ingest/backfill-knowledge-metadata.ts \
  --project notbad-6be95 --business-id not-bad-stuff-demo \
  --config config/knowledge-cloud.json
```

Review every row/conflict and the complete version count, including withdrawn/test uploads. A dry-run does not reserve those rows. Apply only while writers remain quiescent:

```sh
node --import tsx scripts/ingest/backfill-knowledge-metadata.ts \
  --project notbad-6be95 --business-id not-bad-stuff-demo \
  --config config/knowledge-cloud.json \
  --apply --quiescent --confirm-business not-bad-stuff-demo
```

A conflict gives a nonzero exit. Inspect that row and any earlier committed rows; rerun dry-run before resuming. The migration is rowwise CAS, not a whole-business transaction. Repeating apply after success must report changed0 and all rows already correct. Compare preservation fingerprints, independent stock/knowledge snapshot and original bytes against the pre-migration record.

Finish rollout with compatible Knowledge/RAG/PDF backend and browser SDK/frontend, refresh existing tabs, perform the agreed role/source checks, then resume writers. Legacy request recovery is supported by the new backend; this does not certify an old deployed backend against the changed connector signature.

### Rollback boundary

Legacy columns are retained. Before any nonlegacy combination is written, coordinate compatible connector/backend/frontend recovery using the reviewed snapshot. After new combinations exist, an old reader cannot represent them: use a compatible forward fix or an explicitly reconciled recovery. Do not blindly roll back the old frontend or rewrite classification to fit it. Retired/withdrawn versions must remain retired/withdrawn; no re-embedding or PDF replacement is required.

## Scope and next increment

The verification browser build includes the owner's pre-existing compact-login delta, which was explicitly left local. It is **not publication eligible** until exact release scope is approved; generated public configuration and the previous build record are restored after verification. Original frozen release artifacts remain unchanged.

No product links, alias generation/review, shorthand matching, dictation, notification delivery or full translation was added. Existing product matcher limitations remain. Next: a separate increment2 plan for product-document links, generated aliases, collision checks and HQ review.
