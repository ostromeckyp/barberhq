# Manual replenishment cloud release — 14 October 2026

## Release state

The five stock callables and the foundation preview are deployed, and the manual replenishment workflow is **accepted** from the real authenticated browser session. The full PDF reload check after deployment passed. Cloud concurrency, SALON-role, and revocation proof remain outstanding, so the broader increment-2 cloud gate is not READY.

## Backend deployment

The active Gen 2 Node 22 Functions in `europe-west1`, all using `baberhq-runtime@notbad-6be95.iam.gserviceaccount.com`, are:

- `submitRequest`
- `approveRequest`
- `rejectRequest`
- `dispatchTransfer`
- `receiveTransfer`

The public parameters were entered as `STOCK_SQL_SERVICE=notbad-6be95-service` and `STOCK_SQL_LOCATION=europe-west3`. Independent post-deploy inspection confirmed all five Functions ACTIVE and the deployed server connector definitions byte-identical to the repository definitions. No SQL migration/deploy, reset/reseed, IAM change, or schema mutation occurred. The source PDF Function remained ACTIVE and was not redeployed.

The Functions were prepared in the isolated `artifacts/stock-functions` package. It contains an explicit compiled-code and generated-runtime allowlist, byte-identical generated SDK runtime files, and pinned `firebase-admin` 14.5.0, `firebase-functions` 7.4.0, and `zod` 4.6.5 dependencies. Its derived SDK manifest removes the stale Firebase Admin 13 peer constraint; the normal install resolved 245 packages. This did not change generated SDK runtime code.

Preparation and deployment commands, from the repository root:

```sh
npm --prefix functions run build
node --import tsx scripts/config/prepare-stock-functions.ts
cd artifacts/stock-functions/functions
npm install --ignore-scripts
cd ..
../../node_modules/.bin/firebase deploy --only functions:stock:submitRequest,functions:stock:approveRequest,functions:stock:rejectRequest,functions:stock:dispatchTransfer,functions:stock:receiveTransfer --config firebase.json --project notbad-6be95 --interactive
```

The CLI created all five Functions successfully; its optional post-deploy cleanup prompt was cancelled, producing CLI exit code 2 after creation. Independent ACTIVE-state checks confirmed the deployed resources. That optional cleanup remains outstanding and outside this release scope. The five unauthenticated protocol checks returned HTTP 401 `UNAUTHENTICATED`; they were not an isolated App Check test.

## Foundation preview

Only the allowed public artifact `artifacts/cloud-public-config.json` was changed: `replenishmentEnabled` is `true`, with the other feature flags false. Both public SQL parameters were supplied to the Functions deployment. The production build and release gate passed with 49 files and SHA-256 `7f2eae36a552cac2eb1a2d8175df9638deeff3983566209e44f62780fef133c4`. The foundation Hosting release succeeded at [https://notbad-6be95--foundation-unesffgt.web.app](https://notbad-6be95--foundation-unesffgt.web.app), expiring `2026-10-21T15:12:54.628323205Z` (17:12 Warsaw time).

## Browser acceptance and stock results

All five commands were exercised through the real App Check protected UI with the authenticated HQ session acting on behalf of Legnicka. Request `e02311d0-1f64-4248-9eea-a5516a8fb7da` contained Cement 2 and DryMatt 1 and progressed `PENDING_APPROVAL → RESERVED → DISPATCHED → RECEIVED`. Approval reserved 2/1 while HQ physical stock stayed 18/18. Dispatch changed HQ to 16/17 and placed 2/1 in transit. Full receipt changed Legnicka from 2/2 to 4/3 and cleared transit to 0/0. The UI also showed the all-products-intact checkbox checked, Cement received 1 of 2, and Confirm disabled; after restoring 2, full receipt completed.

Request `7c8b19d7-7491-45c3-8ead-2683fdc9f753` (Matowa 1) was rejected with reason “Synthetic demo verification — rejected without stock changes.” HQ remained 18, Legnicka remained 2, and the salon version remained 1 for that item. The rejected request was visible in salon-filtered history.

| Evidence | Result |
| --- | --- |
| Baseline | 24 inventory rows; HQ 18 units and each salon 2 units per item |
| Final request history | 2 requests: one received, one rejected; 0 active requests |
| Transfer | 1 transfer, 2 transfer items; full quantities received |
| Stock movements | 4 total: 2 dispatch and 2 receipt movements |
| Action receipts | 6 |
| Unaffected inventory | Quantities and versions unchanged |

An independent sanitized SQL assertion passed. Baseline and final snapshots are `artifacts/cloud-stock-before.json` and `artifacts/cloud-stock-after.json`. Browser evidence is in `artifacts/cloud-request-{reserved,dispatched,received,rejected}.png`. The 390×844 mobile request entry opened the product bottom sheet with Add product, quantity controls, and Submit; no additional request was submitted (`artifacts/cloud-mobile-request.png`). The viewport was reset afterward. Normal demo history was retained; no destructive cleanup was performed.

The full PDF reload check passed after the stock deployment: the native accessibility view showed the source, v1, physical page 1, intake chunk `...:1:2`, excerpt, PDF canvas, and Download button. Evidence: `artifacts/cloud-pdf-after-replenishment.png`. The source PDF Function remains unchanged and ACTIVE. Local SDK-only enum declaration aliases were restored for the existing processor; there was no SDK runtime change.

## Verification evidence

The implementation report records 17 focused checks, root typecheck, Functions build, isolated install and discovery of exactly five exports, and a clean final scoped code review. The authenticated browser acceptance and independent sanitized SQL assertions passed. A broader unit run had one SDK-enum declaration failure at an earlier snapshot; the declarations were repaired and the focused SDK-enum checks subsequently passed. No full-suite pass is claimed here.
