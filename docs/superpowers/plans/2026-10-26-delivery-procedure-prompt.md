# Delivery procedure prompt implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this single scoped UI task.

**Goal:** Open the existing procedure assistant with an editable relevant question and preserve delivery entry.
**Architecture:** Fixed problem marker → scoped assistant prefill; reuse deliveryReturn validation and DeliveryDraftStore. Procedures owns the back action; its root facade retains context through cited PDFs.
**Tech Stack:** Existing Angular22 signals/router/material and Vitest.
**Spec:** `docs/superpowers/specs/2026-10-26-delivery-procedure-prompt-design.md`.

## Global constraints

Preserve owner staging/checkout. No cloud writes, dependency changes, automatic AI submission, copied report data or arbitrary return URLs. Keep existing source PDF actions. Existing assistant provider failure is independent.

## Review focus

Damaged/missing/both prompts; no auto-submit; edited question survives tab/PDF return; revoked or changed workspace cannot expose an old delivery return; feature disabled/locked receipt has no active suggestion.

## Task1: Suggested question and bounded round trip

Files: delivery receipt facade/template, procedure assistant facade/page, shared fixed question helper and corresponding Angular specs.

- [x] Add behavioral tests for relevant prefill, no submission, valid/invalid scoped return, scope clearing, preserved draft and consumed marker; run focused Angular tests and observe failures.
- [x] Implement fixed enum questions and receipt action; simplify redundant warnings, retaining available source buttons and feature flags.
- [x] Implement authorized prefill/return, consume marker on Procedures, and retain edited question/return through existing PDF navigation.
- [x] Run focused then full Angular suite, development build and graph update. Review scoped changes; preserve evidence, no commit/deploy.

### Task2: Mark all as good (owner follow-up)

- [x] Add a failing UI test for multiple dispatched quantities and preservation of report fields; verify no command and no edits while locked.
- [x] Add `markAllGood()` to the receipt facade and the explicit button below inspection instructions. Set quantities only and use existing lock guard.
- [x] Verify both tasks together, build, graph, and scoped review.
