# Knowledge publication

The canonical synthetic knowledge PDF can be published through the existing Firebase project `notbad-6be95`. Its cloud identifiers and embedding settings are recorded in `config/knowledge-cloud.json`; local Data Connect and emulator configuration remain the source for development.

After the schema and server operations are ready, stage the cloud-only Data Connect tree with:

```sh
node --import tsx scripts/config/prepare-knowledge-cloud.ts
```

The default script refreshes ignored `artifacts/cloud-knowledge/` from the current `dataconnect/schema/*.gql` files and the `server` and `vector` connector `.gql` files. It preserves both connector IDs without SDK generation blocks and creates a minimal Firebase config that points only to the staged Data Connect service. Browser connectors, seed data, and emulator exports are not staged by default.

Review the staged files before publication, then run the repository-pinned Firebase CLI from `artifacts/cloud-knowledge` with the intended project explicitly selected:

```sh
../../node_modules/.bin/firebase dataconnect:sql:diff --project notbad-6be95 --config firebase.json
# Review every proposed change before accepting the migration prompt.
../../node_modules/.bin/firebase dataconnect:sql:migrate --project notbad-6be95 --config firebase.json
../../node_modules/.bin/firebase deploy --only dataconnect:notbad-6be95-service:schema,dataconnect:notbad-6be95-service:server,dataconnect:notbad-6be95-service:vector --project notbad-6be95 --config firebase.json
```

This deploys the configured schema and server/vector connector operations; it does not deploy Functions, Hosting, browser connectors, or publish the PDF itself. The pinned CLI requires a separate migration when the database is incompatible. Do not use the repository root Firebase config for this publication, since it also contains emulator, Hosting, and Functions settings. Rerun the preparation command immediately before reviewing or deploying if schema or operation files have changed. A Data Connect SQL diff may complete SQL linking for the service, so treat it as a potentially stateful operation rather than a purely read-only preview.

Keep the explicit `:schema` selector when connector changes depend on new GraphQL fields/types. In the pinned CLI, selecting only `:server` and `:vector` skips schema publication even after a successful SQL migration, and the API can reject the connectors with `invalid connector sources`. Explicit resource filters also preserve the existing browser connector, which is absent from the default server/vector artifact; an unfiltered full deployment can instead propose deleting absent connectors.

To prepare a separate, reviewed browser connector deployment after the schema and server/vector publication, explicitly include the browser operations:

```sh
node --import tsx scripts/config/prepare-knowledge-cloud.ts --include-browser
```

This rebuilds the same ignored artifact with schema and all current server, vector, and browser `.gql` operations, including `GetSourceSection`. It preserves their connector IDs, uses the service and location in `config/knowledge-cloud.json`, and omits SDK generation settings. Inspect the staged files first. A browser connector deployment is a pending manual step; from `artifacts/cloud-knowledge`, its targeted command with the pinned CLI is:

```sh
../../node_modules/.bin/firebase deploy --only dataconnect:notbad-6be95-service:browser --project notbad-6be95 --config firebase.json
```

The production Angular build also needs a browser SDK generated separately for the matching cloud service, location, and connector target. Staging the connector does not prepare that SDK or satisfy the existing SDK/config match guard. Do not treat browser staging as a completed cloud deployment.

The operator CLI uses application default credentials and the separately recorded cloud configuration. After the Data Connect schema/server/vector connectors are deployed and `Business(id: "not-bad-stuff-demo")` exists, run each step explicitly from the repository root:

```sh
npm run ingest -- stage --project notbad-6be95 --business-id not-bad-stuff-demo
npm run ingest -- extract --project notbad-6be95 --business-id not-bad-stuff-demo
npm run ingest -- status --project notbad-6be95 --business-id not-bad-stuff-demo
npm run ingest -- review --project notbad-6be95 --business-id not-bad-stuff-demo --receipt data/knowledge/reviews/DAM-001-v1.approval.json
npm run ingest -- status --project notbad-6be95 --business-id not-bad-stuff-demo
npm run ingest -- publish --project notbad-6be95 --business-id not-bad-stuff-demo --expected-revision 0
```

Compare the `status` PDF and extraction hashes with the review receipt before review. `extract` writes the page map and readable chunk text to `data/knowledge/derived/`; `review` preserves the human-authored receipt there. Use the current document revision from `status` for publication. The `publish` step checks the complete reviewed pages and embeddings in one guarded Data Connect transaction. Repeat `status` afterward to verify the active version pointer. The CLI does not deploy schema or create the business row.
