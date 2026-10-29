# Firebase — first increment owner checklist

Owner project: `notbad-6be95`. Read-only checks refreshed on 13 October 2026: Storage and SQL Connect exist; the cloud knowledge schema/server/vector connectors and approved DAM-001 v1 are published. The owner registered `BarberHQ Demo` as a Web app and CLI confirmed it is ACTIVE. Manual replenishment and the authorized PDF viewer are verified locally; this does not certify a deployed Angular application. See the resource and verification record in [increment 3A](handoffs/increment-3a.md).

1. In the Firebase console, create a dedicated demo project and enable billing (Blaze). Record the actual project ID. Set budget alerts.
2. Register a Web app and copy its public Firebase configuration. Do not send passwords or service-account keys.
3. Enable Authentication → Email/Password. Prepare one HQ and three salon accounts (Legnicka, Łódzka, Zakładowa). Record UIDs in a local ignored file, not committed documents.
4. Choose a compatible European location before provisioning SQL Connect/Data Connect and Cloud SQL. Record service ID, location, instance and database. The agent supplies schema and connector code; do not create tables manually.
5. Classic Hosting site `notbad-6be95` already exists (read-only discovery). Confirm this is the intended demo destination. Add actual development/live domains to Auth settings where required.
6. Register the Web app in App Check using reCAPTCHA Enterprise. Record the public site key. Keep any local debug token private; do not disable enforcement to pass cloud checks.

Storage and embeddings are already configured for operator publication. Gemini reasoning is a later checkpoint. To finish the current PDF source deployment, follow the additional runtime/API requirements in [PDF source setup](pdf-source-setup.md).

Give the agent the project ID and public web/service/site configuration once ready. Use the typed example under `config/` when available. The agent will validate project consistency, generate connector SDKs, seed the agreed fictional stock and run actual cloud checks before marking this increment READY.

Detailed reference: [Firebase setup guide](../06-firebase-setup-guide.md).

For the later private Storage and Vertex AI setup, follow the [RAG owner checklist](rag-owner-checklist.md).
