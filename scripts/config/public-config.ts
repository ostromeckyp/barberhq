import { z } from 'zod';
const identifier = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/);
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search;
}, 'A credential-free HTTPS endpoint without a fragment is required');
const schema = z
  .strictObject({
    projectId: identifier,
    firebase: z.strictObject({
      projectId: identifier,
      apiKey: z.string().min(1),
      appId: z.string().min(1),
      authDomain: z.string().min(1),
      messagingSenderId: z.string().optional(),
      storageBucket: z.string().optional(),
    }),
    functionsRegion: identifier,
    dataConnect: z.strictObject({
      serviceId: identifier,
      location: identifier,
      browserConnectorId: identifier,
    }),
    hostingSiteId: identifier,
    appCheck: z.strictObject({ siteKey: z.string().min(1) }),
    messaging: z.strictObject({ vapidKey: z.string().min(1) }).optional(),
    pdfReadUrl: httpsUrl.optional(),
    pdfUploadUrl: httpsUrl.optional(),
    replenishmentEnabled: z.boolean(),
    knowledgeEnabled: z.boolean(),
    replenishmentAiEnabled: z.boolean(),
    ragEnabled: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.projectId !== c.firebase.projectId)
      ctx.addIssue({
        code: 'custom',
        message: 'Firebase project does not match selected project',
      });
    if (
      (c.ragEnabled && !c.knowledgeEnabled) ||
      (c.replenishmentAiEnabled && !c.replenishmentEnabled)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'AI feature requires its parent feature',
      });
  });
export type PublicConfig = z.infer<typeof schema>;
export function parsePublicConfig(raw: unknown): PublicConfig {
  return schema.parse(raw);
}
