# BarberHQ Angular app

Angular 22.2 + Material standalone SPA. Login and scoped salon inventory are implemented against Firebase Auth/Data Connect, with local emulator verification.

- [Angular architecture, facades and UI customization](../docs/implementation/angular-architecture.md)
- [Local startup, accounts and Hosting guide](../docs/implementation/deployment-runbook.md)
- [Current implementation evidence](../docs/implementation/handoffs/increment-1.md)
- [Design reference](../design_handoff_barberhq/SPEC.md)

Run setup/build/test commands from the repository root as documented in the runbook. `npm run demo:local` prepares the isolated local demo. `npm --prefix web run start:emulator` starts its Angular UI after the emulators are running. `npm run test:web` runs Angular tests and `BARBERHQ_TEST_MODE=emulator npm run test:e2e` verifies the running app.

The default development build intentionally has no cloud credentials/configuration. Use the explicit configuration/build scripts for emulator or production profiles; never hand-edit generated SDKs or public configuration files.
