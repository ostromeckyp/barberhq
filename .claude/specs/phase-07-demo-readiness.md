# Spec: Phase 7 — deployment and presentation rehearsal

> Prove the deployed demo is repeatable and ready for the existing 20-minute talk.

## Background

Read shared contracts, phase-05/06 handoffs and `docs/03-demo-runbook.md`. All implementation phases are complete. Follow the [Firebase Hosting deployment specification](firebase-hosting-deployment.md) for preview, live promotion and rollback; phase 4 supplies its build/configuration implementation. Use `docs/02-slide-outline.md` only to align stage timings and demonstrated claims.

Read the [approved design extensions](approved-design-extensions.md) for this phase’s approved batch, document-library and PDF-geometry responsibilities.

## Requirements

1. Deploy/verify the schema/connectors, functions and private Storage rules separately, then build Angular and deploy it to a Firebase Hosting preview channel in the intended demo project. Verify that preview, promote the same Hosting version to live, and record both URLs and release identity. Exercise frontend rollback and restore the intended version following the deployment specification. Preview/live share demo backend data; reset explicitly before rehearsal, never as part of deployment. Confirm public web settings, exact regions/bucket, Auth domains, App Check, model permissions and separate demo identities match the owner setup guide.
2. Run a deployed end-to-end two-account stock scenario and a separate Zakładowa damaged-delivery question. Capture final stock quantities, actual citations and successful original-PDF page navigation with an exact region highlight. Confirm an unauthorized account cannot access business data or source files.
3. Verify batch partial-success/retry behavior, the 2→4 low-stock marker change, HQ import/review/replacement/deletion and salon management denial. Use separate document fixtures; keep the rehearsed corpus stable. Check live/preview upload CORS, worker retry, document-tab URLs and chunk deep links. These are readiness checks; document administration need not consume the six-minute live slot.
4. Exercise explicit demo reset and rehearse again. Reset only demo operational records; keep product identities and published knowledge intact. Record how to verify the initial 18/2 stock state before the talk.
5. Check model/embedding failure and connectivity behavior. Manual stock workflow remains available when AI fails. Prepare a clearly labeled recorded walkthrough or screenshots as stage fallback; never present recorded/cached output as a live model result.
6. Time the existing six-minute demo within the 20-minute talk. Update runbook and slide Markdown with verified behavior, costs/latency observations if measured, and real limitations. Do not claim business savings or production-scale validation from this demo.
7. Produce a final readiness report: deployed checks, remaining issues, reset instructions, fallback artifact locations and exact rehearsal duration. Distinguish specification completion from actual implementation readiness.

## Affected Files

| File | Change type | Description |
|---|---|---|
| `docs/implementation/deployment-runbook.md` | Modify | Exact verified build, preview, promotion, origins and rollback instructions |
| `docs/03-demo-runbook.md` | Modify | Verified reset, account switching, timing and fallback |
| `docs/02-slide-outline.md` | Modify | Align claims with demonstrated behavior |
| `docs/06-firebase-setup-guide.md` | Modify | Verified resource/setup notes without secrets |
| `docs/implementation/handoffs/phase-07.md` | Create | Final readiness evidence |

## Existing Patterns to Reuse

- Reuse existing runbook and slide narrative; do not expand into packaging or production scheduling.
- Reuse phase-03 explicit reset and the focused checks from earlier phases.

## Constraints

- Only deploy to the configured demo project. Do not broaden tests or add features once required checks pass.
- Business-owner approval of real policies is a future pilot requirement, not something synthetic PDFs establish.

## Open Questions

No design decision remains. A missing resource/account or failed deployed check must be reported as a concrete blocker.

## Acceptance Criteria

- [ ] All Hosting deployment-spec acceptance checks pass, including live deep links, origin configuration, same-version promotion and demonstrated rollback.
- [ ] Deployed stock and RAG scenarios pass on the live Hosting URL with real configured services and correct permissions.
- [ ] Reset/replay is repeatable; PDF citations still resolve after a reset.
- [ ] Approved extension checks pass against deployed services; stage evidence highlights actual PDF text.
- [ ] Live demo fits six minutes and the talk outline fits twenty.
- [ ] Readiness report lists evidence and any material limitations without claiming unperformed checks.
