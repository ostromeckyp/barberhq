import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';

// Imported first by index.ts: ES imports run in order, so the app and the global options
// (read eagerly by onCall) are in place before any function module defines its services.
initializeApp();

setGlobalOptions({
  serviceAccount: 'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com',
});
