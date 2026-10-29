import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it, expect } from 'vitest';

const schemaRoot = 'dataconnect/schema';

function gqlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return gqlFiles(path);
    return entry.name.endsWith('.gql') ? [path] : [];
  });
}

const operationRoot = 'dataconnect';
const expectedOperations: Record<string, string[]> = {
  server: [
    'AcceptProductKnowledgeSnapshot',
    'AdmitAiWindow',
    'ApplyProductAliasSeed',
    'ApproveStock',
    'BackfillKnowledgeCursor',
    'BackfillKnowledgeMetadata',
    'BeginKnowledgeExtraction',
    'BindKnowledgeOriginal',
    'BindReplayKey',
    'ChangeDeliveryIssue',
    'ClaimKnowledgeExtraction',
    'ClaimProductKnowledgeGeneration',
    'CompleteKnowledgeRetry',
    'CompleteKnowledgeReview',
    'ConfirmSalonShorthand',
    'CreateDeliveryReplacement',
    'CreateProductAdmin',
    'DispatchStock',
    'FailKnowledgeExtraction',
    'InsertInventory',
    'InsertKnowledgePage',
    'InsertLegacyDeliveryReceipt',
    'InsertSalonSettings',
    'IssueReplenishmentChoiceReceipts',
    'KnowledgeCommandContext',
    'KnowledgeCursorBusiness',
    'KnowledgeCursorDocuments',
    'KnowledgeCursorLabels',
    'KnowledgeDocumentState',
    'KnowledgeMetadataPage',
    'KnowledgeVersionState',
    'MarkKnowledgePageReviewed',
    'MarkKnowledgePublishStale',
    'MarkKnowledgeReady',
    'ProductKnowledgeActiveAliasPage',
    'ProductKnowledgeCatalogPage',
    'ProductKnowledgeState',
    'PublishKnowledgeVersion',
    'ReadAiActor',
    'ReadAiCurrentWindow',
    'ReadCollisionAliases',
    'ReadCollisionProducts',
    'ReadDeliveryBindings',
    'ReadDeliveryContext',
    'ReadDeliveryKey',
    'ReadDeliveryProcedureDocument',
    'ReadIssueContext',
    'ReadKnowledgeWipeCounts',
    'ReadMembership',
    'ReadProductAdmin',
    'ReadProductAdminOperation',
    'ReadProductAdminScope',
    'ReadProductAliasRevisions',
    'ReadProductAliasSeedState',
    'ReadProductAliases',
    'ReadProductCardAttachment',
    'ReadProductCodeOwner',
    'ReadReplacementSlots',
    'ReadReplenishmentAliasPage',
    'ReadReplenishmentProductPage',
    'ReadReplenishmentSalonAliasPage',
    'ReadReplenishmentSnapshotHeader',
    'ReadResetCounts',
    'ReadSalonAliasOperation',
    'ReadSalonShorthandConfirmation',
    'ReadSalonShorthandScope',
    'ReadSeedState',
    'RecheckProcedureSources',
    'RecordDeliveryTransaction',
    'RecordKnowledgeReview',
    'RecordOperatorProductReview',
    'RegisterKnowledgeVersion',
    'RejectStock',
    'ReleaseProductKnowledgeGeneration',
    'RemoveSalonShorthand',
    'ResetDemoStock',
    'ResetProductAdmin',
    'RevokeKnowledgeVersion',
    'SaveKnowledgeExtraction',
    'SaveProductAliases',
    'SaveProductCardAttachment',
    'SaveProductKnowledgeSnapshot',
    'SearchEligibleProcedureChunks',
    'SeedDeliveryProcedureBindings',
    'SeedProductCardAttachment',
    'SetDeliveryProcedure',
    'SetHqStockAdmin',
    'SetKnowledgeDispatchFailure',
    'SetKnowledgeDispatchPending',
    'SetKnowledgePublishIntent',
    'SetOperatorKnowledgePublishIntent',
    'StageKnowledgeVersion',
    'StartKnowledgeRetry',
    'StartKnowledgeReview',
    'StockContext',
    'SubmitStock',
    'UpdateProductAdmin',
    'UpsertBusiness',
    'UpsertLocation',
    'UpsertMembership',
    'UpsertProduct',
    'UpsertSalonAccess',
    'WipeDemoKnowledge',
  ],
  browser: [
    'GetDeliveryIssue',
    'GetDeliveryProcedureBindings',
    'GetDeliveryReceipt',
    'GetHqInventory',
    'GetKnowledgeProductReview',
    'GetKnowledgeReview',
    'GetMyMembership',
    'GetRequestDetail',
    'GetSalonInventory',
    'GetSalonSettings',
    'GetSourceSection',
    'ListActiveRequests',
    'ListDeliveryIssues',
    'ListDeliveryProcedureDocuments',
    'ListHQQueue',
    'ListHqKnowledgeDocuments',
    'ListHqShorthand',
    'ListProducts',
    'ListPublishedKnowledgeDocuments',
    'ListSalonRequests',
    'ListSalonShorthand',
    'SaveSalonSettings',
  ],
  vector: ['InsertKnowledgeChunk', 'SearchKnowledgeChunks'],
};

describe('code structure', () => {
  it('schema: one type or enum per file, named after it', () => {
    const problems: string[] = [];
    for (const file of gqlFiles(schemaRoot)) {
      const rel = relative(schemaRoot, file);
      if (!rel.includes('/')) problems.push(`${rel}: must live in a domain folder`);
      const names = [...readFileSync(file, 'utf8').matchAll(/^(?:type|enum) (\w+)/gm)].map(
        (m) => m[1],
      );
      if (names.length !== 1) {
        problems.push(`${rel}: expected exactly one type or enum, found ${names.length}`);
      } else if (!rel.endsWith(`/${names[0]}.gql`)) {
        problems.push(`${rel}: file name must be ${names[0]}.gql`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('operations: grouped by domain, files <= 300 lines unless a single operation', () => {
    const problems: string[] = [];
    for (const [connector, expected] of Object.entries(expectedOperations)) {
      const root = join(operationRoot, connector);
      const names: string[] = [];
      for (const file of gqlFiles(root)) {
        const rel = relative(root, file);
        if (!rel.includes('/')) problems.push(`${connector}/${rel}: must live in a domain folder`);
        const source = readFileSync(file, 'utf8');
        const ops = [...source.matchAll(/^(?:query|mutation) (\w+)/gm)].map((m) => m[1]);
        names.push(...ops);
        const lines = source.split('\n').length;
        if (lines > 300 && ops.length !== 1) {
          problems.push(`${connector}/${rel}: ${lines} lines with ${ops.length} operations`);
        }
      }
      if (JSON.stringify(names.sort()) !== JSON.stringify(expected)) {
        problems.push(`${connector}: operation names differ from the HEAD baseline`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('contracts: one exported model per file', () => {
    const root = 'shared/contracts';
    const kebabToName = (file: string, upper: boolean) => {
      const parts = file.replace(/\.ts$/, '').split('-');
      return parts
        .map((p, i) => (i === 0 && !upper ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join('');
    };
    const problems: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        problems.push(`${entry.name}: must live in a domain folder`);
        continue;
      }
      const dir = join(root, entry.name);
      const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
      if (!files.includes('index.ts')) problems.push(`${entry.name}: missing index.ts`);
      for (const file of files.filter((f) => f !== 'index.ts')) {
        const source = readFileSync(join(dir, file), 'utf8');
        const exported = [
          ...source.matchAll(/^export (?:declare )?(interface|type|const|function) (\w+)/gm),
        ];
        if (exported.length !== 1) {
          problems.push(
            `${entry.name}/${file}: expected exactly one export, found ${exported.length}`,
          );
          continue;
        }
        const [, kind, name] = exported[0];
        const isModel = kind === 'interface' || kind === 'type';
        if (name !== kebabToName(file, isModel)) {
          problems.push(
            `${entry.name}/${file}: export must be named ${kebabToName(file, isModel)}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('functions: models in models/, logic <= 300 lines', () => {
    const root = 'functions/src';
    const tsFiles = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'generated' ? [] : tsFiles(path);
        return entry.name.endsWith('.ts') ? [path] : [];
      });
    const problems: string[] = [];
    for (const file of tsFiles(root)) {
      const rel = relative(root, file);
      const source = readFileSync(file, 'utf8');
      const inModels = /^[^/]+\/models\/[^/]+\.ts$/.test(rel);
      if (!inModels && /^export (?:declare )?(?:interface|type)\b/m.test(source)) {
        problems.push(`${rel}: exported interface/type must live in <domain>/models/`);
      }
      const lines = source.split('\n').length;
      if (lines > 300) problems.push(`${rel}: ${lines} lines (max 300)`);
      if (/^knowledge\/product-knowledge-/.test(rel)) {
        problems.push(`${rel}: product-knowledge files belong in product-knowledge/`);
      }
    }
    expect(problems).toEqual([]);
  });
});
