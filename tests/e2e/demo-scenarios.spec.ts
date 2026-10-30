import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createCloudHarness } from '../support/cloud.ts';
import { resetRecords } from '../../scripts/seed/reset.ts';
import { seedProcedureCitation } from './procedure-rag.fixture.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let source: Awaited<ReturnType<typeof seedProcedureCitation>>;
let contexts: BrowserContext[] = [];
const question = 'A jar of Pomada Matowa arrived cracked at Zakładowa. What should we do?';
const guidance = 'Do not mark an affected unit as good stock.';

type StockSnapshot = {
  inventories: { locationId: string; productId: string; onHand: number; reserved: number }[];
  requests: { id: string; state: string }[];
  active: unknown[];
  items: { quantity: number }[];
  transfers: unknown[];
  transferItems: { quantity: number; dispatchedQuantity: number; receivedQuantity: number }[];
  movements: { type: string; quantity: number }[];
  receipts: unknown[];
  keys: unknown[];
  deliveryReceipts: unknown[];
  deliveryCommands: unknown[];
  deliveryKeys: unknown[];
  settings: unknown[];
};
async function stockSnapshot(): Promise<StockSnapshot> {
  const { data } = await h.operator.executeGraphql<StockSnapshot, { id: string }>(
    `query($id:String!){
      inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
      requests:replenishmentRequests(where:{businessId:{eq:$id}},orderBy:[{id:ASC}]){id salonId state revision createdAt}
      active:activeRequests(where:{businessId:{eq:$id}},orderBy:[{salonId:ASC},{productId:ASC}]){salonId productId requestId}
      items:requestItems(where:{request:{businessId:{eq:$id}}},orderBy:[{id:ASC}]){id requestId productId quantity}
      transfers(where:{businessId:{eq:$id}},orderBy:[{requestId:ASC}]){requestId warehouseId destinationId}
      transferItems(where:{transfer:{businessId:{eq:$id}}},orderBy:[{requestItemId:ASC}]){requestItemId transferRequestId quantity dispatchedQuantity receivedQuantity}
      movements:stockMovements(where:{businessId:{eq:$id}},orderBy:[{transferItemRequestItemId:ASC},{type:ASC}]){transferItemRequestItemId type quantity actorUid createdAt}
      receipts:actionReceipts(where:{businessId:{eq:$id}},orderBy:[{id:ASC}]){id actorUid idempotencyKey requestId action payloadHash semanticHash state revision reason createdAt}
      keys:actionKeys(where:{businessId:{eq:$id}},orderBy:[{actorUid:ASC},{idempotencyKey:ASC}]){actorUid idempotencyKey receiptId payloadHash}
      deliveryReceipts(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id requestId actorUid recordedAt origin}
      deliveryCommands:deliveryCommandReceipts(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id type target actorUid result}
      deliveryKeys:deliveryActionKeys(where:{businessId:{eq:$id}},orderBy:[{actorUid:ASC},{idempotencyKey:ASC}]){actorUid idempotencyKey commandId payloadHash}
      settings:salonSettingss(where:{salon:{businessId:{eq:$id}}},orderBy:[{salonId:ASC}]){salonId lowStockThreshold version updatedAt}
    }`,
    { variables: { id: h.businessId } },
  );
  return data;
}
async function knowledgeSnapshot() {
  const { data } = await h.operator.executeGraphql(
    `query($id:String!){
      knowledgeDocuments(where:{businessId:{eq:$id}},orderBy:[{id:ASC}]){id documentCode activeVersionId revision nextVersionNumber}
      knowledgeVersions(where:{businessId:{eq:$id}},orderBy:[{id:ASC}]){id documentId versionLabel title language sourceType publicationStatus synthetic sourceUrls observedOn status revision bucket objectPath objectGeneration pdfSha256 contentType byteSize pageCount uploadedAt pendingStage pendingDocumentRevision pendingExtractionHash processingLeaseId processingLeaseExpiresAt parserVersion extractionHash embeddingConfigHash expectedChunkCount reviewedBy reviewedAt reviewedPageCount publishedAt isActive revokedAt processingError processingAttempt createdAt}
      knowledgeOperations(where:{businessId:{eq:$id}},orderBy:[{id:ASC}]){id actorUid idempotencyKey action retryStage payloadHash documentId versionId completedAt createdAt}
      knowledgePages(where:{version:{businessId:{eq:$id}}},orderBy:[{versionId:ASC},{physicalPage:ASC}]){versionId physicalPage text markdown spans printedLabel quality reviewed viewBox userUnit rotation}
      knowledgeChunks(where:{version:{businessId:{eq:$id}}},orderBy:[{id:ASC}]){id versionId physicalPage ordinal sectionId heading text start end rects geometryStatus embedding embeddingModel embeddingDimension embeddingConfigHash}
    }`,
    { variables: { id: h.businessId } },
  );
  return data;
}
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const credentials = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: role === 'hq' ? 'Salon requests' : 'Legnicka',
      exact: true,
    }),
  ).toBeVisible();
}
async function confirm(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
}
async function submit(page: Page) {
  await page.getByRole('button', { name: 'Submit request', exact: true }).click();
  await expect(page.getByText('Request submitted.', { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: 'Open request', exact: true }).click();
  await expect(page).toHaveURL(/\/requests\/[^/]+$/);
  return page.url().split('/').at(-1)!;
}
async function aiFixture(page: Page, unavailable = false) {
  await page.route(/\/(prepareReplenishment|answerProcedureQuestion)$/, async (route) => {
    const headers = {
      'access-control-allow-origin': new URL(page.url()).origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const procedure = route.request().url().endsWith('answerProcedureQuestion');
    await route.fulfill({
      status: unavailable ? 503 : 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(
        unavailable
          ? {
              error: {
                status: 'UNAVAILABLE',
                message: 'Controlled provider outage',
                details: { code: 'PROVIDER_UNAVAILABLE' },
              },
            }
          : {
              result: procedure
                ? {
                    status: 'ANSWER',
                    steps: [{ text: guidance, sourceSectionIds: [source.source.chunkId] }],
                    sources: [source.source],
                    missingInformation: [],
                  }
                : {
                    status: 'PROPOSAL',
                    excluded: [],
                    toolEvents: [],
                    lines: [
                      {
                        status: 'READY',
                        lineId: 'two-matowa',
                        productId: `${h.businessId}:NBS-MATOWA-100`,
                        productName: 'Pomada Matowa',
                        quantity: 2,
                        origin: 'assistant',
                        hqAvailable: 18,
                        salonOnHand: 2,
                        hqInventoryVersion: 1,
                        salonInventoryVersion: 1,
                      },
                    ],
                  },
            },
      ),
    });
  });
  await page.route('**/getSourcePdf?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('versionId') !== source.source.versionId)
      return route.fulfill({ status: 404 });
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: source.bytes });
  });
}

test.describe('Feature: repeatable stock and procedure demonstration', () => {
  test.beforeEach(async () => {
    test.setTimeout(180000);
    // This file must never create fixtures in a cloud project, even when the caller supplies config.
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw new Error('Only isolated Auth/SQL/Functions emulators are allowed');
    h = await createCloudHarness('demo-scenarios');
    contexts = [];
  });
  test.afterEach(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    if (h) await h.dispose();
  });

  test.describe('Given distinct HQ and salon sessions and a fixed synthetic cited PDF', () => {
    let salon: Page, hq: Page;
    let knowledgeBeforeReset: unknown;
    const repetitions: {
      beforeReset: StockSnapshot;
      afterReset: StockSnapshot;
      knowledgeAfterReset: unknown;
      beforeQuestion: StockSnapshot;
      afterQuestion: StockSnapshot;
      knowledgeAfterQuestion: unknown;
    }[] = [];
    test.beforeEach(async ({ browser }) => {
      repetitions.length = 0;
      source = await seedProcedureCitation(h);
      // The base citation fixture is an unpublished HQ review source. This scenario
      // needs a published salon-readable fixture; this setup does not test publication.
      await h.operator.executeGraphql(
        `mutation($version:String!,$document:String!){
          knowledgeVersion_update(key:{id:$version},data:{status:READY,isActive:true,publishedAt:"2026-10-25T00:00:00Z",reviewedPageCount:1})
          knowledgeDocument_update(key:{id:$document},data:{activeVersionId:$version})
        }`,
        { variables: { version: source.source.versionId, document: source.source.documentId } },
      );
      knowledgeBeforeReset = await knowledgeSnapshot();
      for (let i = 0; i < 2; i++) contexts.push(await browser.newContext());
      salon = await contexts[0].newPage();
      hq = await contexts[1].newPage();
      await aiFixture(salon);
      await login(salon, 'legnicka');
      await login(hq, 'hq');
    });
    test.describe('When the operator resets and completes both scenarios twice', () => {
      test.beforeEach(async () => {
        for (let i = 0; i < 2; i++) {
          const beforeReset = await stockSnapshot();
          await resetRecords(h.operator, h.businessId, true);
          expect(await stockSnapshot()).toEqual(beforeReset);
          await resetRecords(h.operator, h.businessId, false);
          const afterReset = await stockSnapshot();
          const knowledgeAfterReset = await knowledgeSnapshot();
          await salon.goto(`/salons/${encodeURIComponent(h.legnickaId)}`);
          await salon.getByRole('tab', { name: 'Assistant', exact: true }).click();
          await salon.getByLabel('What do you need?').fill('Send two Matowa to Legnicka.');
          await salon.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
          await expect(salon.getByLabel('Units for Pomada Matowa')).toHaveValue('2');
          expect(await stockSnapshot()).toEqual(afterReset);
          const id = await submit(salon);
          await hq.goto(`/hq/requests/${id}`);
          await confirm(hq, 'Approve request');
          await confirm(hq, 'Confirm dispatch');
          await salon.reload();
          await salon.getByRole('button', { name: 'Check delivery', exact: true }).click();
          await salon
            .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
            .fill('2');
          await salon.getByRole('button', { name: 'Record inspection', exact: true }).click();
          await salon.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
          await salon.getByRole('button', { name: 'Back to request', exact: true }).click();
          await salon.getByTestId('in-transit').waitFor();
          const beforeQuestion = await stockSnapshot();
          await salon.goto('/procedures');
          await salon.getByRole('textbox', { name: 'Question', exact: true }).fill(question);
          await salon.getByRole('button', { name: 'Ask assistant', exact: true }).click();
          await expect(salon.getByText(guidance, { exact: true })).toBeVisible();
          await salon.getByRole('link', { name: /^Open paragraph / }).click();
          await expect(salon.getByTestId('pdf-highlight')).toHaveCount(2);
          await expect(salon.getByTestId('pdf-highlight').first()).toBeVisible();
          await expect(salon.getByTestId('pdf-page-number')).toHaveText('1');
          await salon.getByRole('button', { name: 'Back to Procedures', exact: true }).click();
          await expect(salon.getByRole('textbox', { name: 'Question', exact: true })).toHaveValue(
            question,
          );
          await expect(salon.getByText(guidance, { exact: true })).toBeVisible();
          repetitions.push({
            beforeReset,
            afterReset,
            knowledgeAfterReset,
            beforeQuestion,
            afterQuestion: await stockSnapshot(),
            knowledgeAfterQuestion: await knowledgeSnapshot(),
          });
        }
      });
      test('Then repeatable_two_scenarios_preserve_knowledge and each stock transfer moves two units once', async () => {
        expect(repetitions).toHaveLength(2);
        expect(repetitions[1].beforeReset.requests).toHaveLength(1);
        for (const run of repetitions) {
          expect(run.afterReset.requests).toEqual([]);
          expect(run.afterReset.items).toEqual([]);
          expect(run.afterReset.transfers).toEqual([]);
          expect(run.afterReset.transferItems).toEqual([]);
          expect(run.afterReset.movements).toEqual([]);
          expect(run.afterReset.receipts).toEqual([]);
          expect(run.afterReset.keys).toEqual([]);
          expect(
            run.afterReset.inventories.find(
              (row) =>
                row.locationId === `${h.businessId}:hq` &&
                row.productId.endsWith(':NBS-MATOWA-100'),
            ),
          ).toMatchObject({ onHand: 18, reserved: 0 });
          expect(
            run.afterReset.inventories.find(
              (row) => row.locationId === h.legnickaId && row.productId.endsWith(':NBS-MATOWA-100'),
            ),
          ).toMatchObject({ onHand: 2, reserved: 0 });
          expect(run.knowledgeAfterReset).toEqual(knowledgeBeforeReset);
          expect(run.knowledgeAfterQuestion).toEqual(knowledgeBeforeReset);
          expect(run.afterQuestion).toEqual(run.beforeQuestion);
          expect(run.beforeQuestion.requests).toEqual([
            expect.objectContaining({ state: 'RECEIVED' }),
          ]);
          expect(run.beforeQuestion.items).toEqual([expect.objectContaining({ quantity: 2 })]);
          expect(run.beforeQuestion.transferItems).toEqual([
            expect.objectContaining({ quantity: 2, dispatchedQuantity: 2, receivedQuantity: 2 }),
          ]);
          expect(run.beforeQuestion.active).toEqual([]);
          expect(run.beforeQuestion.movements).toEqual([
            expect.objectContaining({ type: 'DISPATCH', quantity: 2 }),
            expect.objectContaining({ type: 'RECEIPT', quantity: 2 }),
          ]);
          expect(run.beforeQuestion.receipts).toHaveLength(3);
          expect(run.beforeQuestion.deliveryReceipts).toHaveLength(1);
          expect(run.beforeQuestion.deliveryCommands).toHaveLength(1);
          expect(run.beforeQuestion.deliveryKeys).toHaveLength(1);
          expect(run.beforeQuestion.keys).toHaveLength(3);
          expect(
            run.beforeQuestion.inventories.find(
              (row) =>
                row.locationId === `${h.businessId}:hq` &&
                row.productId.endsWith(':NBS-MATOWA-100'),
            ),
          ).toMatchObject({ onHand: 16, reserved: 0 });
          expect(
            run.beforeQuestion.inventories.find(
              (row) => row.locationId === h.legnickaId && row.productId.endsWith(':NBS-MATOWA-100'),
            ),
          ).toMatchObject({ onHand: 4, reserved: 0 });
        }
      });
    });
  });

  test.describe('Given the AI provider is unavailable', () => {
    test.beforeEach(async ({ page }) => {
      await aiFixture(page, true);
      await login(page, 'legnicka');
    });
    test.describe('When staff encounter both assistant failures and submit a manual request', () => {
      let before: StockSnapshot;
      test.beforeEach(async ({ page }) => {
        before = await stockSnapshot();
        await page.goto('/procedures');
        await page.getByRole('textbox', { name: 'Question', exact: true }).fill(question);
        await page.getByRole('button', { name: 'Ask assistant', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
        await expect(page.getByRole('heading', { name: 'What to do', exact: true })).toHaveCount(0);
        expect(await stockSnapshot()).toEqual(before);
        await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}`);
        await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
        await page.getByLabel('What do you need?').fill('2 Matowa');
        await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Use Manual');
        expect(await stockSnapshot()).toEqual(before);
        await page.getByRole('tab', { name: 'Manual', exact: true }).click();
        await page.getByLabel('Product', { exact: true }).click();
        await page.getByRole('option', { name: 'Pomada Matowa', exact: true }).click();
        await page.getByLabel('Quantity', { exact: true }).fill('2');
        await page.getByRole('button', { name: 'Add to list', exact: true }).click();
        await submit(page);
      });
      test('Then the ordinary request is created without a stock movement or fabricated answer', async ({
        page,
      }) => {
        const after = await stockSnapshot();
        expect(after.requests).toEqual([expect.objectContaining({ state: 'PENDING_APPROVAL' })]);
        expect(after.items).toEqual([expect.objectContaining({ quantity: 2 })]);
        expect(after.inventories).toEqual(before.inventories);
        expect(after.movements).toEqual([]);
        expect(after.transfers).toEqual([]);
        await expect(page.getByRole('heading', { name: /^Pomada Matowa/, level: 1 })).toBeVisible();
      });
    });
  });
});
