# Release verification — plan 5 continuation

25 October 2026. Local tooling, pinned preview verification and **controlled live rollback/restoration with unchanged scoped data are complete**. [Two reset-based rehearsals](demo-rehearsal-2026-10-25.md) subsequently completed stock correctly; only the first full RAG run passed. Full protected-command/upload smoke and final successful stage repetitions remain pending.

## New tooling

- `scripts/release/verify.ts`: typed identity, version/build/config/backend drift checks, literal-only extraction of the bundled public configuration, comparison with an explicitly approved snapshot, and independent reconstruction of the build configuration hash.
- `scripts/release/cli.ts`: explicit target/artifact/hash/config arguments. `--artifact-only` verifies a candidate locally before publication. Hosted mode checks the selected channel origin, finalized version, every public file, headers and backend ready revisions before/after; local files are checked again. `--out` refuses to overwrite a record.
- `npm run check:release` never publishes, resets or ingests. Hosted mode needs installed Firebase CLI and gcloud. Backend fingerprint hashes actual service/region/latest-ready-revision tuples without environment values; it does not certify traffic allocation, data or compatibility by itself.
- `validatePromotion(before,current)` rejects changed project/site/version/build/config/backend identity. Destination channel/URL may differ when promoting the same version. It neither authorizes nor executes publication.

Use a named reviewed public-config.json snapshot. An environment file or stale generated-file baseline does not establish that the intended live configuration is retained.

```sh
npm run check:release -- \
  --project notbad-6be95 --site notbad-6be95 \
  --artifact artifacts/ui-state-release/back-buttons-corrected \
  --approved-public-config artifacts/ui-state-release/back-buttons-corrected/public-config.json \
  --expected-build-hash c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70 \
  --artifact-only
```

For hosted verification, omit `--artifact-only` and add `--channel live --base-url https://notbad-6be95.web.app --out artifacts/releases/UNIQUE-verified-release.json`. Use existing CLI authentication; no credentials belong in arguments.

## Observed production identity

Fresh record: `artifacts/releases/2026-10-25-diagnostics-live.json`. The later [diagnostic backend publication](rag-phase-diagnostics-2026-10-25.md) preserves frontend bytes but has an unresolved max-instance configuration difference.

| Identity | Observed value |
| --- | --- |
| Live version | `4b833190c12b9244` |
| Build | `c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70` |
| Independently verified config hash | `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5` |
| Backend ready-revision fingerprint | `sha256:70d731fe7b978973ba53dbb097a9d33612077f545054946d0d6caa573aedb5f6` |
| Hosted files | 59, byte-identical |

Preview and live retain the same frontend version/build/config. The latest backend identity follows the diagnostic publication. The controlled data-preservation proof is recorded below; the backend fingerprint alone does not establish it.

## Verification

- Release/Hosting unit suites28/28 and root TypeScript pass. RED captured for missing behavior, artifact drift, fabricated config metadata and local-only preflight.
- The rejected Back package fails the approved-config comparison before cloud metadata is read; the intended package passes preflight and hosted checks.
- Six local UI failure/recovery scenarios pass. Existing scoped operational reset and published-knowledge preservation checks each pass; knowledge originals are fixtures, not a cloud Storage assertion.
- Independent review found two P2 issues: a shortage test expected absent helper fields, and configHash metadata was trusted. Fixed in one pass using exact SQL snapshots and a RED→GREEN independent configuration-hash check. No deferred findings.
- No Angular/backend application code changed; no application rebuild/backend deployment was required. Existing artifacts were selected through Hosting releases. The reset operator CLI correction below is local tooling.
- Strict literal parser accepts emitted data only; unsupported JavaScript/templates fail closed. Root TypeScript7 exposes no compiler API, so no compiler API or extra dependency was introduced.

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/remaining-states/`. Earlier browser failures were fixture/selector errors, not application regressions.

## Controlled cloud trial — completed

The owner explicitly approved the quiet window and pinned preview/rollback/restoration trial: “Tak — aplikacja jest wolna, wykonaj próbę”. Preview and live share data. No reset, stock command or document mutation was included.

| Step | Actual result, 25 October Warsaw time |
| --- | --- |
| Baseline | Two matching read-only snapshots of `not-bad-stuff-demo` before publication |
| Pinned preview | Replaced `f97f1aa60feaf08c` with `4b833190c12b9244`; verifier passed at 01:48:00, record `artifacts/releases/2026-10-25-preview-pinned.json` |
| Authenticated preview | Existing SALON session read Documents and rendered DAM-001 v1 PDF; Procedures Back returned to the Documents tab |
| Promotion identity | `validatePromotion` passed against the verified live record. Pinned clone returned HTTP400 because the supplied version was already active: no new live release was created at this step |
| Rollback | Pinned `6dca66a0ba4ae78d` clone succeeded at 01:51:02; full hosted verifier passed at 01:51:18; `artifacts/releases/2026-10-25-live-rollback.json` |
| Restore | Pinned `4b833190c12b9244` clone succeeded at 01:51:27; full 59-file verifier passed at 01:51:44; `artifacts/releases/2026-10-25-live-restored.json` |
| Data comparison | After promotion attempt, during rollback and after restoration: all scoped hashes/counts matched baseline. Final snapshot 01:51:49 |
| Authenticated restored live | Existing HQ session read Documents and rendered DAM-001 v1; Procedures Back returned to the Documents tab |

Firebase CLI15.32.0; [preview](https://notbad-6be95--foundation-unesffgt.web.app), [live](https://notbad-6be95.web.app). Both release artifacts retain configuration hash `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`. During this earlier Hosting trial, backend ready revisions stayed at `sha256:154c843bba85f0d9624532f4215021f2f3a3980a4bd9b9cb2a7d8563ad685771`. No rebuild, backend/schema/rules/origin change, security weakening or stock/document mutation occurred.

Snapshot scope: 24 inventories, 4 requests, 2 active entries, 5 request items, 2 transfers, 3 transfer items, 5 movements, 10 receipts, 10 action keys, 3 salon settings; 5 knowledge documents, 7 versions, 6 operations, 9 pages and 19 chunks. Original generations and selected object metadata/checksums matched for 7 private originals. Original PDF bytes were not downloaded for this comparison; unrelated businesses and tables were not certified.

| Scoped digest | SHA-256, unchanged at every checkpoint |
| --- | --- |
| Operational records | `1ffc25faaf96583ca0d76f9139ed6503af991a349c2652955fd1069a5036af80` |
| Knowledge records | `0d5db94d9156dcfc25061525a4ffef843e121066406dbf6ab9e2b0d33a57c52f` |
| Original metadata | `fc69b2293c1f6cb1ec3498de818fe82fc6c02923f68f361a1db94ebddd9cb52c` |

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/rollback/` contains clone logs, exclusive release records, dated hash/count snapshots and authenticated browser screenshots. The trial runner attempted restoration in `finally` even if rollback verification failed; every executed trial step passed. This is a demonstrated frontend rollback/restoration, not a full backend traffic/compatibility certification. Full protected-command/upload smoke, remaining deployed concurrency gates and two timed reset-based demonstrations stay separate acceptance work.

## Reset preparation and subsequent rehearsals

The first reset dry-run failed before mutation: the generated server SDK points to the old `europe-west1/barberhq` target. `scripts/seed/reset.ts` now requires explicit public configuration for cloud execution and pins the approved project/site/service/region. Local reset transaction semantics are unchanged. Raw SDK errors are replaced with controlled CLI error codes so request headers cannot be printed. Four focused tests were captured RED→GREEN; root TypeScript passes and independent review found no actionable issues.

The corrected **read-only** dry-run initially reported **41 operational rows and 24 inventories**, restored to HQ18 / salons2, reserved0 by the approved transaction. Knowledge documents/versions/pages/chunks/originals and memberships/products/settings are outside that reset transaction. The owner subsequently continued the reviewed reset/rehearsal scope: reset1 applied 41 deletions/24 inventories, reset2 applied 14 deletions/24 inventories. [Actual results and preserved knowledge/original hashes](demo-rehearsal-2026-10-25.md) are recorded separately. Exact preparation dry-run command:

```sh
node --import tsx scripts/seed/reset.ts \
  --project notbad-6be95 --business not-bad-stuff-demo \
  --confirm not-bad-stuff-demo --quiescent \
  --config artifacts/ui-state-release/back-buttons-corrected/public-config.json \
  --dry-run
```

The rollback approval excluded reset/business mutations; the later owner continuation authorized the separately described reset/rehearsal scope. Rehearsals used two Matowa units per run and captured three genuine offline fallbacks. Final demo acceptance remains open because repetition2 reached a real RAG timeout and its retry also failed. The later approved [diagnostic publication](rag-phase-diagnostics-2026-10-25.md) produced a successful5.32s production answer without reproducing the timeout. Preview App Check and the max-instance difference remain open; this is not a second full rehearsal.
