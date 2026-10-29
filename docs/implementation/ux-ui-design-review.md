# UX/UI application versus design review — 24 October 2026

Plan 5 Task 1A. Owner-reported details were reproduced and corrected in the **running local Angular application**, using isolated Auth/SQL fixtures. The original [screen board](../../design_handoff_barberhq/BarberHQ%20Screens.dc.html), [OrderPanel](../../design_handoff_barberhq/OrderPanel.dc.html), prototype and [SPEC](../../design_handoff_barberhq/SPEC.md) were inspected as references, not changed. Current code formatting from the owner was preserved.

## Findings and outcome

| Finding | Before / design reference | Correction / actual verification |
|---|---|---|
| Tab icons missing | OrderPanel: `auto_awesome` / `list_alt`; procedures V8: `auto_awesome` / `folder_open` | Restored decorative Material icons; English accessible tab names preserved; browser checks and screenshots |
| Remove X below quantity centre | Three-item request: measured 10px vertical offset | Dynamic subscript size for the quantity field; remove button aligns within 2px of its visible field |
| Mobile sheet handle and close scroll away | Long 320px sheet: handle moved 582px | Stationary handle/close chrome plus separate scroll body; matched container/content 90dvh limit; scroll, bottom Submit visibility, Enter/Escape, focus restoration and retained draft pass |
| “English questions only” | Present below Question | Removed; Polish input accepted, no implication of Polish output support |
| Redundant six-item instruction overlaps actions | Owner requested removal after initial spacing fix | Entire hint removed; examples/action gap checked at desktop; six-item validation remains existing behavior until the separate replenishment increment changes it |
| Request example controls missing | Design has Example / Several products | Both fill input only; disabled during busy/locked state or missing catalog; tests confirm zero AI calls and unchanged manual quantities/stock |
| Product examples were hard-coded | New owner spec disallows product-specific examples in source | Generate examples from the current salon inventory’s product names; generic placeholder. Fixture names live only in tests |
| Procedure example was static prose | V8 has a clickable question example | Clickable generic Polish question, fills only Question; search icon restored to Ask action |
| Primary preparation action / list heading | Reference has an emphasized preparation action and Request list | Existing Prepare proposal now uses filled Material styling and its icon; Request list heading added |
| Example accessible name hid visible text | Independent review found `aria-label="Example question"` overriding the Polish text | Removed override; the test locates the button by its visible question. Focused regression observed RED before the correction; final browser suite passes |

Examples intentionally use catalog data rather than the exact product-specific sentences in the old design. This follows the new [product knowledge/dictation design](../superpowers/specs/2026-10-24-product-knowledge-and-dictated-replenishment-design.md). No aliases, two-turn orchestration, document-kind migration or microphone control were implemented in this UX slice.

## Evidence

- Full Angular suite: **28 files / 125 tests PASS**.
- Browser suites `ux-ui-design.spec.ts`, `ui-states.spec.ts`, `procedure-rag.spec.ts`: **20/20 PASS**. Real local login/SQL; controlled AI/PDF fixtures for UI states, no model-quality claim.
- Root TypeScript and optimized production build pass; frozen artifact identity is in the [preview review](ui-state-preview-review.md).
- Independent source review found one P2 accessible-name issue, corrected with RED→GREEN verification; no other correctness/data-scope findings. Untracked targets were absent from the graph and inspected directly; graph update ran after source changes.

Raw evidence: `.superpowers/sdd/2026-09-29-barberhq-05-demo-release/ux-ui/`. Before/after screenshots include `sheet-{before,after}-scrolled.png`, `remove-{before,after}.png`, `examples-after-{320,1280}.png`, `procedures-after-320.png` and `design-procedures.png`. Final application screenshots were visually inspected. The initial desktop example screenshot captured a tab transition; it was recaptured after waiting for stable field position. Earlier interrupted runs with stopped local servers are infrastructure failures, not application regressions.

## Polish questions — separate hosted experiment

Existing signed-in Salon — Legnicka session on `foundation`; current published UI/backend, **not the new local frontend**:

1. “Do Zakładowej dotarł pęknięty słoik Pomady Matowej. Co mamy zrobić i jakie informacje przekazać centrali?” returned five **English** steps with DAM-001 v1 physical-page-1 intake, report and decision citations. Captured answer/excerpts agree; this new answer has agent inspection, not a new human claim approval.
2. “Jaki jest ustawowy termin zgłoszenia reklamacji do przewoźnika po uszkodzeniu przesyłki?” returned **No supported answer / No eligible source supports this question**.

Two outcomes were captured (`polish-damage.*`, `polish-unsupported.*`). There was one additional submission of the unsupported question before the browser session ended on user steering; its result was not captured and is not counted as a pass. No latency claim is made from manual observation intervals. These were question submissions only; no stock/document command was invoked. No before/after cloud data snapshot was taken in this UX slice.

This supports trying Polish input on these two cases. The current contract still sends `answerLanguage: 'en'` and the backend prompt assumes English. Polish answers and robust dictated product matching remain separate work; removing a hint does not certify them.

## Review limits and next gate

This is a scoped UX review and correction, not pixel-for-pixel certification of every historical prototype state. Existing role/scope, atomic request, real Auth, reviewed publication and extracted-page deviations remain authoritative. Manual select/numeric fields retain their implemented Material interaction; no autocomplete/stepper redesign was introduced. The source-only rare states in [UI coverage](ui-state-coverage.md) remain final rehearsal checks. Current model/retrieval limitations remain documented.

The owner subsequently approved publication (“publikuj”): the new UX candidate is now on `foundation`, Hosting version `f97f1aa60feaf08c`. Scoped hosted smoke confirmed exact files, valid Auth/App Check, PDF highlights and answer return, markerless Back, examples and stationary sheet chrome at 320px. Details and evidence are in the [publication result](ui-state-preview-review.md). Version-aware live promotion/rollback and two timed rehearsals remain outstanding; the earlier preview package stays historical.

## Subsequent original-design follow-up

The owner requested closer fidelity for Procedures and request cards, then direct per-step PDF paragraph links and breadcrumb return preserving search state. These are implemented locally in a new unpublished package; the previous publication above is historical. See [the follow-up report](design-fidelity-review.md) for exact scope, verification and frozen identity.
