# RAG phase diagnostics — 25 October 2026

**Published and exercised; timeout cause remains unknown.** One production question passed with Auth and App Check valid. The configuration-preservation gate has an explicit outstanding difference.

## Publication and identity

The owner continued after the specific single-function publication proposal. Scope: diagnostic-only `answerProcedureQuestion` and one controlled question, without reset, stock or corpus mutation.

- Frozen candidate: `artifacts/rag-phase-diagnostics-2026-10-25/`; 46-file manifest SHA-256 `cf25d36adee1e1b60fcd2ceae0c2d7dc7f30de9735600e714b73a2d8ece5b03b`. Its original `review.json` records the historical prepared review, not the subsequent publication outcome.
- Only compiled `procedure.js` changed and `procedure-diagnostics.js` was added. Prompt, source checks, model, dependencies and 25-second answer budget were preserved. Five diagnostics tests, compilation, export loading and independent candidate review passed before publication.
- Standard noninteractive Firebase CLI15.32.0 stopped before update because nine declared public parameters needed explicit resolution. The installed Node deploy entry point then used a guarded in-memory adapter containing those existing public values; no environment file was read or generated.
- The Node CLI returned a generic failure, but Cloud Build `443ccbcd-1f76-4994-b084-33750d933835` actually succeeded and the function became ACTIVE. Cloud state, rather than CLI exit status, establishes this deployment.
- Revision before: `answerprocedurequestion-00001-nik`; diagnostic deployment: `answerprocedurequestion-00002-soz`; after the scaling restoration attempt: **`answerprocedurequestion-00003-biv`**, ACTIVE, all traffic on latest revision.
- Other **13 deployed functions** unchanged. Target environment/secrets hashes, runtime account, CPU, memory, concurrency, ingress and function timeout match baseline. Candidate package exports 13 functions; the remote project has 14, including separately deployed replenishment.

### Outstanding scaling difference

`serviceConfig.maxInstanceCount` was previously absent; after deployment it is **20**. A narrow PATCH setting it to0 completed, but the subsequent API read still returned20. This is **not** a successful restoration or a proven preservation of all configuration. The strict comparison records `passed:false` and `configurationPreserved:false`. No further blind deployment or scaling mutation was attempted; the reason for retention is unproven.

## Controlled question

The first preview attempt failed HTTP401 before RAG: Auth VALID, App Check MISSING, zero phase events. Browser `appCheck/recaptcha-error` occurred before this deployment and after reload. The existing SCORE key already lists the exact preview domain; no domain/IAM/App Check settings were changed. A subsequent protected PDF read also displayed the reCAPTCHA error. The owner subsequently clarified that their successful PDF check was on **production** (`https://notbad-6be95.web.app`), not preview. The controlled preview error remains unexplained; that human check does not verify preview.

The same synthetic damaged-delivery question was then submitted once through the existing **production HQ session**, at08:48:00UTC. HTTP200 in **5.323042436 seconds**, Auth VALID and App Check VALID. Ten phase events cover five successful stages, attempt1:

| Stage | Time |
| --- | ---: |
| Actor | 115.461 ms |
| Admission | 81.967 ms |
| Retrieval | 545.684 ms |
| Generation | 4048.708 ms |
| Citation/source recheck | 46.563 ms |

The visible answer contained four instructions grounded in three DAM-001v1 chunks: separate damaged units, collect the specified evidence safely, report through the established internal HQ channel and retain details, then await HQ disposition. The earlier human approval of a captured five-step answer does not automatically approve this new answer.

The previous 25-second timeout **did not reproduce**. This single successful question neither fixes nor explains it, and does not replace a full timed stock-plus-guidance rehearsal.

## Preservation and release verification

Read-only before/after operational, knowledge and seven original-metadata hashes match. No reset, stock command or document mutation occurred in this diagnostic trial. Knowledge SHA-256 remains `0d5db94d9156dcfc25061525a4ffef843e121066406dbf6ab9e2b0d33a57c52f`; original metadata remains `fc69b2293c1f6cb1ec3498de818fe82fc6c02923f68f361a1db94ebddd9cb52c`. This scope excludes unrelated businesses/tables and a full original-byte comparison.

Fresh live record: `artifacts/releases/2026-10-25-diagnostics-live.json`, verified08:48:28.853UTC. Hosting remains `4b833190c12b9244`, build `c8003c2ef7bd0794d09c006523ac43d4c2aae9ca90edaad7a4e12e58fc3f2f70`, config `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`; all59 hosted files match. New backend ready-revision fingerprint: `sha256:70d731fe7b978973ba53dbb097a9d33612077f545054946d0d6caa573aedb5f6`. This fingerprint is not a traffic, data or compatibility certificate.

Evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/diagnostic-publication/`, especially `build-result.json`, `metadata-after-observed.json`, `phase-proof-live.json`, `live-answer.jpg`, `preview-pdf-error.jpg`, `data-before.log`, `data-after.log` and `release-after.log`.

Remaining: diagnose any recurring timeout with the new stage evidence, resolve the scaling difference and the controlled-session App Check discrepancy, complete the protected-origin/concurrency/upload gates, two successful full rehearsals and human presentation checks. Plan5 remains **NOT READY**.
