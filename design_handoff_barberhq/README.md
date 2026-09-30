# Handoff: BarberHQ — salon stock ordering (Angular Material)

## Overview
This is an internal web app for barber salons and the HQ warehouse:
- **Salon staff** check the stock in their salon, request products (manually or through an AI assistant draft), follow each request and confirm receipt.
- **HQ** approves requests (which reserves stock), confirms dispatch and manages procedure PDFs.
- **Everyone** can ask the procedure assistant, which answers with citations to PDF pages.

## About the design files
The files here are **design references created in HTML**. They're prototypes that show the intended look and behaviour, not production code. The task is to **recreate them in Angular with Angular Material (M3)** using that stack's established patterns.

The `.dc.html` files open directly in a browser as long as `support.js` sits next to them. They need an internet connection for React and Google Fonts.

## Fidelity
**High fidelity.** Colours, type, spacing, states and copy are final. Build to Material components themed to match these values; don't reproduce the pixels by hand.

## Files
| File | What it is |
|---|---|
| `AGENTS.md` | Short instructions for coding agents (Codex etc.) |
| `SPEC.md` | Full specification: tokens, layout, the Material/custom component map, roles, data, interaction rules |
| `BarberHQ Screens.dc.html` | Board with every view and state, grouped Shared / Barber shop / HQ, with IDs (V1…, S18…, P1…) |
| `BarberApp.dc.html` | Clickable prototype. Demo accounts are in SPEC.md; any password works. |
| `OrderPanel.dc.html` | Order panel reference: Assistant / Manual tabs, shared batch list, every state via `mode` |
| `RequestDialog.dc.html` | Approve / dispatch / receive dialogs: idle, sending, mismatch |
| `StatusChip.dc.html` | The five request status chips |
| `docs/damaged-delivery-v1.2.pdf` | Synthetic 3-page procedure PDF used for citations. Replace it with real documents. |
| `support.js` | Runtime that renders the references. **Not part of the build.** |

## Screens
Full detail per view is in SPEC.md §5. Routes:
- `/login`: sign in, plus states for invalid input, signing in, error, checking access and no access
- `/salons/:salonId`: stock table, OrderPanel, active requests
- `/requests/:requestId`: status, next step, quantities, timeline, and the approve / dispatch / receive dialogs
- `/hq`: request queue (HQ only)
- `/procedures`: assistant with a cited answer; `?tab=documents` shows the document list (view only for salons, add and delete for HQ)
- `/procedures/sources/:versionId?page=N`: PDF opened at the cited page

## Design tokens, interactions, state
See SPEC.md §1–4 for tokens and layout, §5a–5b for roles and batch requests, §6 for scenario data and §7 for interaction rules.

## Assets
- Fonts: Archivo and IBM Plex Mono from Google Fonts.
- Icons: Material Symbols Outlined.
- There are no raster images. The only document is the demo PDF in `docs/`.
