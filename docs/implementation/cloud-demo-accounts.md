# Cloud demo memberships

Use existing Firebase Auth users in the approved cloud project. Prepare a private membership JSON file with the same structure as `config/memberships.example.json`: one UID, role, and salon assignment per entry. HQ entries have no salon keys; salon entries have at least one approved salon key. Keep this file private.

The standalone seed uses the checked-in `data/seed/business.json` catalog and the service and location selected by the public config and `config/knowledge-cloud.json`. Run from the repository root with Node 22 and ADC credentials for the approved project:

```sh
node --import tsx scripts/seed/cloud-demo.ts --config PUBLIC_CONFIG_FILE --memberships PRIVATE_MEMBERSHIP_FILE --dry-run
```

Review the generic count report. The dry run checks that each selected Auth account exists and is enabled, reads current membership and seed state, and makes no writes. To insert missing records and update catalog metadata after review:

```sh
node --import tsx scripts/seed/cloud-demo.ts --config PUBLIC_CONFIG_FILE --memberships PRIVATE_MEMBERSHIP_FILE --apply
```

The apply mode keeps existing stock quantities and inserts only missing stock rows. It also preserves existing requests, salon settings, and knowledge records. The script refuses emulator variables, mismatched target settings, placeholder or duplicate memberships, and accounts already assigned to another business. Output contains only project, service, business, mode, and counts; errors use generic codes.
