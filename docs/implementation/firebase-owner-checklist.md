# Firebase — first increment owner checklist

The app is being prepared locally. Owner project: `notbad-6be95`. Read access verified on 2026-09-30; no Web apps or Data Connect services are registered yet. No cloud resources have been created or deployed by the agent.

1. In the Firebase console, create a dedicated demo project and enable billing (Blaze). Record the actual project ID. Set budget alerts.
2. Register a Web app and copy its public Firebase configuration. Do not send passwords or service-account keys.
3. Enable Authentication → Email/Password. Prepare one HQ and three salon accounts (Legnicka, Łódzka, Zakładowa). Record UIDs in a local ignored file, not committed documents.
4. Choose a compatible European location before provisioning SQL Connect/Data Connect and Cloud SQL. Record service ID, location, instance and database. The agent supplies schema and connector code; do not create tables manually.
5. Prepare classic Hosting (not App Hosting). Record site ID. Add actual development/live domains to Auth settings where required.
6. Register the Web app in App Check using reCAPTCHA Enterprise. Record the public site key. Keep any local debug token private; do not disable enforcement to pass cloud checks.

Storage, embeddings and Gemini are later checkpoints and do not block the first inventory screen.

Give the agent the project ID and public web/service/site configuration once ready. Use the typed example under `config/` when available. The agent will validate project consistency, generate connector SDKs, seed the agreed fictional stock and run actual cloud checks before marking this increment READY.

Detailed reference: [Firebase setup guide](../06-firebase-setup-guide.md).
