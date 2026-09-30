# Firebase setup guide for the presenter

**27 September 2026 · preparation guide, not a record of completed setup.**

**Delivery sequencing update, 29 September:** no Firebase project exists yet. Follow the [incremental delivery design](superpowers/specs/2026-09-29-barberhq-delivery-design.md) for timing: project/billing, Auth, SQL Connect and the initial Hosting configuration support increment 1; private Storage, embedding access and the ingestion worker support increment 3; answer/tool-use model configuration supports increment 4. Verify compatible regions before provisioning. The numbered sections below remain setup references, not a requirement to configure all services before the first inventory screen. The agent loads initial SQL memberships in increment 1, extracting this responsibility from original phase 3.

Use this before the cloud portions of implementation phases 2 and 3. You provide the project, billing and account choices; the backend agent creates the application schema, rules and code from the specs. Local product/PDF preparation can proceed independently.

## 1. Create or select one demo project

In the [Firebase console](https://console.firebase.google.com/), select your intended project or create a dedicated DevFest demo project. Record its **project ID**, which is different from the display name. Enable the **Blaze** billing plan: Cloud Storage now requires it, and this design also uses Cloud SQL, functions and model calls. Set billing alerts appropriate to your demo budget; alerts are not a spending cap. See [Storage prerequisites](https://firebase.google.com/docs/storage/web/start).

Register a Web app in the project and copy its Firebase web configuration into the local setup record below. These client identifiers are not service-account credentials. Keep private keys, access tokens and account passwords out of the repository.

Choose locations before provisioning. Prefer compatible nearby regions for SQL Connect, Cloud SQL, functions and the selected model; verify current availability rather than assuming all services offer the same location. Record the Storage location separately. Use the [SQL Connect service and database guide](https://firebase.google.com/docs/sql-connect/manage-services-and-databases) and [Cloud SQL locations](https://docs.cloud.google.com/sql/docs/postgres/locations).

## 2. Enable Authentication and prepare demo users

For a predictable stage demo, enable **Email/Password** in Authentication → Sign-in method. Create four users in the console: one HQ operator and one staff user for each salon. Use addresses you control and distinct passwords stored outside this workspace. Record each Firebase UID in a local ignored membership mapping. There is no public registration screen in the app.

These users initially have no business access. Increment 1 creates SQL membership/salon-access records using their UIDs (the structured-seed responsibility originally assigned to phase 3). Signing in successfully is not equivalent to having an HQ role.

Add your development hostname and deployed Hosting hostname under authorized domains where required; enter hostnames, without protocols or ports. The backend must separately configure allowed origins for the PDF read and upload HTTP endpoints. If you prefer Google sign-in later, enable that provider and obtain each user's UID after their first sign-in, then load memberships. Do not delay the default email/password setup for that optional alternative. See [password authentication](https://firebase.google.com/docs/auth/web/password-auth) and [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## 3. Provision SQL Connect / Data Connect

Open SQL Connect in Firebase (some configuration paths and tooling still use **Data Connect**). Follow the [official quickstart](https://firebase.google.com/docs/sql-connect/quickstart) to provision/select the service and underlying Cloud SQL PostgreSQL database. Keep this demo separate from a business production database.

Record service ID, location, instance and database names. Give these to the phase-02 agent. That agent owns `dataconnect/`, the schema, scoped GraphQL operations, connector IDs and generated SDK configuration. You do not need to manually create tables, author SQL or copy a PostgreSQL password into Angular. If the console offers a starter schema, the app specification remains authoritative.

The agent must compile the schema/vector configuration and validate transactional behavior against the deployed database. A successful console setup alone does not prove the app's GraphQL operations or permissions work. See [SQL Connect authorization](https://firebase.google.com/docs/sql-connect/authorization-and-security).

## 4. Create private Storage

Open Storage → Get started, choose the intended bucket location, and begin with restrictive rules. Copy the **exact bucket name** shown in the console; do not guess its suffix from the project ID.

This design denies direct browser file access. The backend agent will deploy `storage.rules` equivalent to:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

Operator ingestion preloads the five approved PDFs using server credentials/IAM. HQ can later register/upload PDFs through a protected backend proxy; the server writes private originals and enqueues reviewed processing. The app opens them through an authenticated backend endpoint which verifies SQL membership and source access. Server SDK access uses IAM and is not granted by these client rules. Do not enable public sharing or create permanent download-token URLs. See [Storage security](https://firebase.google.com/docs/storage/security).

## 5. Enable server model access and deployment identities

The proposed provider is **Vertex AI through Genkit**, with Gemini for answers/tool use and an available compatible text embedding model for retrieval. Enable the required API and billing in the selected Google Cloud project. The phase-02 agent must verify model IDs, supported region, embedding dimension and document/query modes before pinning configuration. The earlier 768-dimension suggestion is provisional until verified.

Use your authenticated local developer identity for initial deployment and operator tasks, and configured runtime service identities for deployed functions. Avoid downloaded service-account JSON keys. Have the agent document the minimum IAM grants actually needed for SQL Connect operations, Vertex AI, PDF reads, upload-proxy writes, worker access and task enqueue/invocation. Configure Cloud Tasks for the ingestion worker, restrict invocation to the task service identity, and cap retries/concurrency. The backend agent supplies the queue/region and exact IAM grants; see [task queue setup](https://firebase.google.com/docs/functions/task-functions). Grant runtime Storage access at the intended bucket where possible; ingestion needs create/read access to verify immutable originals, while the PDF endpoint needs read access. Do not solve access errors by making the bucket public.

Keep deployment/admin privileges distinct from application-user roles. Ordinary salon users cannot seed the database or manage documents. HQ membership permits document upload/review/replacement/deletion through scoped APIs, without granting cloud administration or seed/reset access. See [Genkit Vertex AI integration](https://genkit.dev/docs/integrations/vertex-ai/).

## 6. Register App Check and Hosting

Register the web app with App Check using reCAPTCHA Enterprise and configure the allowed domains. Give the public provider/site configuration to the Angular agent. Keep local App Check debug tokens private and outside committed files. Integrate and verify valid requests before enabling enforcement; the demo-readiness phase must confirm enforcement is active for supported services and the functions' own verification paths. Both PDF HTTP endpoints (read and upload) verify App Check explicitly. See [web App Check setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

Use **classic Firebase Hosting** for the Angular SPA; this is the confirmed choice. Record the intended Hosting site ID and use its provided live URL initially; a custom domain is optional. Follow the [deployment specification](../.claude/specs/firebase-hosting-deployment.md): phase 4 supplies the production build/configuration, phase 7 verifies preview, promotion and rollback. Record exact preview/live hostnames in Auth/App Check settings as applicable and their origins in both PDF endpoint allowlists. Preview and live share the demo backend and stock.

Hosting serves compiled browser files and has no frontend server environment. Give the agent public Firebase/API settings for build-time configuration; a settings change requires rebuilding/redeploying. Keep model credentials in backend configuration. Do not create an App Hosting backend, add `apphosting.yaml` or enable SSR for environment variables. Configuration files containing private UIDs or credentials must not be included in Hosting output.

## 7. Local setup record to give the agent

Have the backend agent add ignore rules before saving the local `firebase-setup.local.md` and private UID mapping; share only nonsecret resource settings in the handoff report. Fill values from the console, not inferred names.

| Setting | Value to record |
|---|---|
| Project | project ID and project number |
| Billing | Blaze enabled; alert configured |
| Web app | app ID and public Firebase web config |
| Auth | enabled provider, authorized domains |
| Membership mapping | local private file path containing four UIDs and their intended roles/salons |
| SQL Connect | service ID, location, Cloud SQL instance, database; connector IDs supplied by agent |
| Storage | exact bucket name and location |
| Functions | chosen region and runtime service identity |
| Models | provider, project/location, Gemini model, embedding model/dimension verified by agent |
| Web deployment | Hosting site/origin and local development origin |
| App Check | public provider settings; private debug token stored elsewhere |

## 8. Completion checks

Before increment-1 cloud validation: project/billing, Auth users and database service exist; the developer can access the intended project. Before increment-3 PDF ingestion: the private bucket and required runtime identities exist, and embedding-model access/configuration is verified. Storage and embedding setup do not block the first inventory screen.

After agents implement the phases, ask them to demonstrate:

- Authenticated users obtain only their assigned business/salon data; an unassigned user gets no access.
- Phase-03 seed totals match; repeat seeding does not reset current stock.
- The initial five PDFs are private; source access opens the correct version/page and highlight, and unauthorized access fails.
- HQ upload/review/publication works through the configured task queue; salon writes fail. Failed replacement preserves the current document and deletion prevents future retrieval/access.
- Four document versions are active; the retired damage procedure is excluded from retrieval.
- Multi-product drafts create independent requests; the golden stock lifecycle ends HQ16 / Legnicka4, and RAG answers cite reviewed PDF evidence.

Keep the project available for rehearsal. After the event, review billed resources, especially the Cloud SQL instance; stopping application traffic does not by itself remove infrastructure charges. This guide does not authorize deleting any project or data.

## First implementation increment

Follow the [owner checklist](implementation/firebase-owner-checklist.md) for login, scoped inventory and Hosting. Storage and Gemini are configured in later increments.
