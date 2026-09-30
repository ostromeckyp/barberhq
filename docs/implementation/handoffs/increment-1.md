# Increment 1 — implementation evidence

Status: **IN PROGRESS; cloud checks BLOCKED pending owner setup**.

## Local foundation

- Angular CLI scaffold, SPA, no SSR. Material/CDK and Firebase installed.
- Six source products, four locations, 24 synthetic inventory rows. HQ 18, each salon 2, reserved 0. Repeated generation produces identical bytes (SHA-1 `32c123a71549c73a1425726ee62e407e3e7b22c5`).
- Catalog/provenance, imported seed metadata/IDs, public configuration: 15 unit tests passed. Root TypeScript check passed.
- Angular production scaffold build passed, browser output `web/dist/barberhq/browser`.
- Build aborted under the restricted sandbox (exit 134 without diagnostics); identical build passed outside the sandbox without code changes.

## Exact versions

Node 22.22.3; npm 10.9.8. Angular/CLI 22.2.0; Material/CDK 22.2.1; Firebase 12.19.0; Firebase CLI 15.32.0; Angular TypeScript 6.0.3; operator TypeScript 7.0.2; Vitest 5.0.2; Playwright 1.63.0. Lockfiles pin transitive dependencies.

## Cloud prerequisites

Owner project `notbad-6be95`: read access verified on 2026-09-30. Web apps and Data Connect services lists are empty. No cloud mutation, deployment, schema import or Auth test has run. Follow the [owner checklist](../firebase-owner-checklist.md).

Task 1 complete locally. Tasks 2–4 remain in progress/pending. This report does not certify live login, authorization or inventory.
