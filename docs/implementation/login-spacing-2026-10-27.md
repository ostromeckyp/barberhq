# Compact login — prepared 27 October 2026

**Prepared and locally verified; not published.** Production remains frontend `e56c6e784f80e9d1` at https://notbad-6be95.web.app.

The hidden credential error reserved60px above Sign in, plus field subscript and gaps:104px from the password outline to the button. Move the always-reserved feedback to the existing footer, sharing a grid cell with help text. Hidden content retains intrinsic dimensions; only the relevant message is visible and exposed to accessibility. Remove inherited error padding/background in this footer. No authentication TypeScript or backend changes.

Chrome desktop showed card height546.09→475.28px and password-to-button104→32px. Independent IAB checks at1280 and320px found exactly equal card position/size before and after actual rejected synthetic credentials; no horizontal overflow at320px, full message visible, password cleared and no false required error. This is browser viewport proof, not physical iPhone/Safari or screen-reader certification. Original valid-credentials/redirect regression remains covered by the component test.

Validation: new shared help/error accessibility case failed before implementation; final177/177 Angular tests passed. Focused independent review found no actionable issue. Graph updated. Production build succeeded with existing initial-bundle budget warning551.79kB against500kB;66 public files passed artifact preflight. Generated configuration/build record restored byte-for-byte.

Frozen candidate: `artifacts/login-spacing-2026-10-27`, build `afff90e61eb69ac350cd7f9bd4aa1da67657b79e14fbe1092dcce64a50705656`, config `04dbe169bf4f8b841d3c3facde86e271a1a56db47cfa508e373197dd6fbb05a5`. Source manifest differs from the published artifact only in login HTML/SCSS; component spec is separate verification. No deployment authorization is inferred from this report. Publication needs owner approval under the current executing-plans workflow.

Evidence: `.superpowers/sdd/2026-10-27-demo-rehearsal/login-*`, build/freezing helpers and integrity records. Chrome extension popup interrupted one check; the normal IAB performed the remaining UI checks independently. No extension/security protection was bypassed. A sandboxed build exited before diagnostics; outside-sandbox production build succeeded. Freeze-helper schema/missing-list errors were corrected before final integrity checks; no partial candidate was published.
