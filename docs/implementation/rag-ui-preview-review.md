# Procedure assistant — prepared preview release

22 October 2026. **Owner-approved preview published; live generation subsequently verified on 24 October.** The release updated the existing `foundation` Hosting preview to expose the reviewed question/citation UI. Published URL: https://notbad-6be95--foundation-unesffgt.web.app/procedures . Channel expiry: 29 October 2026.

## Concrete scope

- Project/site `notbad-6be95`; existing channel `foundation`, expiry seven days.
- Publish the current production Angular artifact in `web/dist/barberhq/browser`: 57 public files, SHA-256 `8c3162d55865acb1f12a77a8ca042207c970d3037a82173e8280b4961abd3c61`.
- Candidate flags: manual replenishment, knowledge and procedure RAG enabled; replenishment AI disabled. The candidate public configuration is isolated under `artifacts/rag-flow/ui-preview/`; source defaults and generated configuration have been restored after building.
- Preserve the existing preview domain, Firebase Auth, reCAPTCHA Enterprise/App Check and the configured `europe-west1` Functions target. The public configuration matches the existing SQL service in `europe-west3` and the registered site key.

```sh
firebase hosting:channel:deploy foundation \
  --project notbad-6be95 --expires 7d --non-interactive
```

The existing predeploy check binds the production artifact hash to the explicit project and site. Recheck the recorded hash immediately before publication; rebuild and refresh this review if source or artifact contents change. This release does not include a database migration, seed, IAM change, document publication or Functions deployment.

## Evidence and subsequent checks

See the [UI handoff](handoffs/increment-4b.md): 112 Angular tests, desktop and mobile citation/PDF browser checks, typecheck, production build and independent review passed. The initial bundle is 545.02 kB, producing a warning against the 500 kB warning threshold; the build's 1 MB error limit passes.

After publication, verify SPA routes/assets and the real signed-in question → callable → current citations → highlighted PDF path. Confirm authorized HQ/SALON access and unchanged business snapshots. A real question may incur bounded embedding/model usage under AI-0's shared quota. Local fixture success does not prove hosted runtime permissions or the support of generated claims; live evaluation and human review remain required.

## Publication outcome

The approved 57-file artifact was published unchanged after its explicit project/site/hash gate passed. Hosted SPA routes, assets and the PDF worker passed checks. The signed-in browser showed the new Assistant/Documents tabs and the current document library.

The first question was rejected before generation: callable middleware logged `auth: VALID`, `app: MISSING`, HTTP 401. This is a real App Check negative test with valid Auth. The reCAPTCHA component displayed “Nie można połączyć się z usługą reCAPTCHA.” The registered Firebase Web app, App Check site key, score-based Enterprise key and exact preview domain were verified against cloud metadata. Read diagnostics must specify `x-goog-user-project: notbad-6be95`; an initial diagnostic without it incorrectly inspected the ADC client's quota project and returned `SERVICE_DISABLED`.

The browser connection problem remains unresolved. Adblock Plus is present and reports zero blocked elements on this page; that does not establish the extension as the cause. A fresh regular Chrome tab had the same reCAPTCHA warning. The owner was asked to try an incognito sign-in/question to distinguish browser extensions from network filtering. No App Check protection was disabled, no token was extracted, and no additional Firebase configuration change was made.

Evidence: sanitized deployment log `artifacts/rag-retrieval/rag-ui-preview-deploy-approved.log`; Hosting check log `rag-ui-preview-hosting-check.log`; `artifacts/rag-flow/ui-preview/{hosted-acceptance,auth-diagnostic,appcheck-project-proof,public-app-proof,live-after}.json`. The eight document/business snapshot hashes were unchanged across the test window. A successful hosted answer and runtime downstream permissions remain unverified.

## 24 October follow-up

The ordering release refreshed `foundation` on 23 October, extending expiry to 30 October and retaining this RAG UI. Five real signed-in procedure calls now passed Auth/App Check and runtime SQL/Vertex; original cited PDFs opened with highlights. The older browser-connection blocker above was not reproduced; no permanent fix or cause is claimed. No new Hosting/App Check/IAM change occurred in this follow-up. Eight corpus/business hashes remained unchanged. See [current evidence, quality limitation and human gate](rag-hosted-acceptance-2026-10-24.md).
