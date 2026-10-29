# RAG retrieval — server connector publication review

Prepared 21 October 2026. This is Task 4B.1 only: retrieval and measured distance calibration. It does not add generated guidance or an Angular assistant.

**Completed after owner approval, 21 October 2026.** Only the server connector was published. Fresh compatibility diff, published-source comparison, actual named-query HQ/SALON reads and missing-member/foreign-business denials passed; corpus hashes remained unchanged. No Functions or Hosting release occurred. See [accepted retrieval handoff](handoffs/rag-retrieval.md).

## Proposed publication

Target: `notbad-6be95`, service `notbad-6be95-service`, `europe-west3`, connector `server`. Add one `NO_ACCESS` query, `SearchEligibleProcedureChunks`, at the beginning of `dataconnect/server/knowledge.gql`. Existing operations remain identical to their published definitions. The schema, browser connector and vector connector are unchanged; the read-only SQL diff is compatible, with no migration required.

The query uses one parameterized read-only SQL statement. Membership/business and a valid salon assignment authorize the read; a false authorization result becomes `FORBIDDEN`, distinct from no evidence. SQL filters current document pointer, READY/current/active/published/nonrevoked version, matching chunk/version embedding config, model and 768 dimensions before ranking at most three chunks. Returned metadata includes the exact source identity, excerpt, physical page, PDF geometry and document revision.

Prepared config: `artifacts/rag-retrieval/cloud/firebase.json`. The pinned CLI supports the narrow selector:

```sh
firebase deploy --only dataconnect:notbad-6be95-service:server \
  --project notbad-6be95 \
  --config artifacts/rag-retrieval/cloud/firebase.json \
  --non-interactive
```

No database reset, seed, ingestion, stock/document write, new Auth account, IAM grant, Functions export, feature-flag change or Hosting release is proposed. The measured retrieval config remains server source for the next business-flow task; publishing this connector alone does not expose an AI endpoint.

## Verification before publication

The full local integration suite passed against native PostgreSQL 17/pgvector behind the SQL Connect emulator: 20 files / 155 tests, including closer excluded sources, active-pointer/config mismatches, missing membership and salon assignment deny/grant/revoke. PGlite repeatedly crashed with WASM/protocol errors, so its partial successes are not the final acceptance evidence. Native testing uses only isolated local fixtures; its container has no host/named data volume and is removed after verification.

Actual cloud calibration used 20 successful query-embedding calls to `gemini-embedding-001`, 768 dimensions, `europe-west3`, and the exact query as an ad-hoc SQL read. It published nothing. Genkit trace: `04afa9477cdff5884b84da67d1873dcd`, with zero reasoning-model calls. Operator ADC was used; the existing HQ UID was resolved only in memory and omitted from reports. Original questions were verified against their actual trace inputs when adding section annotations; no extra provider calls or altered distances were used for replay.

The selected cosine-distance cutoff is `0.3253804210784045`; smaller means closer. Calibration reached the required sections for 8/9 supported cases and rejected all three unsupported cases. Separate English held-out checks reached 2/3 supported cases and rejected the one unsupported case. Polish section recall was 1/2 and does not enable Polish output. The replacement-decision section was absent from the first three candidates; the held-out Dry Matt question fell outside the cutoff. These are known retrieval misses, not successful answers. Task 4B.2 must handle missing evidence through the bounded retry/abstention path; Task 4B.3 still owns human claim-support evaluation.

## Publication checks and recovery

Immediately before publication, confirm the source fingerprints and no-migration SQL diff remain unchanged. Publish only the server connector. Read back its definitions and compare to the reviewed files, including unchanged schema/browser/vector fingerprints. Exercise the deployed named query using existing demo HQ and salon scope resolved in memory, plus nonexistent/foreign-scope denial probes; do not create or modify business records. Confirm the corpus metadata remains unchanged.

If checks fail, keep AI features disabled and report the exact failed gate. The existing manual and document workflows remain available. Do not reset data, republish source documents or change embeddings to repair a retrieval acceptance failure.

Acceptance and remaining scope will be recorded in `handoffs/rag-retrieval.md`; the complete RAG answer/UI handoff belongs to the later 4B tasks.
