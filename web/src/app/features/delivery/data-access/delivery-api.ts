import { Service, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { FIREBASE } from '../../../core/firebase.providers';
import * as sdk from '../../../core/generated';
import { ReplenishmentApi } from '../../replenishment/data-access/replenishment-api';
import { commandError } from '../../replenishment/data-access/command-error';
import { toDeliveryIssue, toDeliveryIssueSummary, toProcedureBindings } from './delivery.mapper';
import type {
  AddIssueNoteInput,
  DeliveryAction,
  DeliveryCommandResult,
  DeliveryIssuePageDto,
  DeliveryProcedureDto,
  DeliveryReceiptContextDto,
  IssueTransitionInput,
  RecordDeliveryInput,
  SetDeliveryProcedureInput,
} from '../../../../../../shared/contracts/delivery/index';
import type { Page, PageInput } from '../../../../../../shared/contracts/business/index';
const names = {
  RECORD_RECEIPT: 'recordDeliveryReceipt',
  START_REVIEW: 'startDeliveryIssueReview',
  ADD_NOTE: 'addDeliveryIssueNote',
  CREATE_REPLACEMENT: 'createDeliveryReplacement',
  SET_PROCEDURE: 'setDeliveryProcedure',
};
const policy = { fetchPolicy: QueryFetchPolicy.SERVER_ONLY };
export type DeliveryProcedureOption = { documentId: string; title: string; documentCode: string };
@Service()
export class DeliveryApi {
  private readonly firebase = inject(FIREBASE);
  private readonly requests = inject(ReplenishmentApi);
  private async run(action: DeliveryAction): Promise<DeliveryCommandResult> {
    try {
      return (
        await httpsCallable<DeliveryAction['input'], DeliveryCommandResult>(
          this.firebase.functions,
          names[action.type],
        )(action.input)
      ).data;
    } catch (error) {
      throw commandError(error);
    }
  }
  recordReceipt(input: RecordDeliveryInput) {
    return this.run({ type: 'RECORD_RECEIPT', input });
  }
  startReview(input: IssueTransitionInput) {
    return this.run({ type: 'START_REVIEW', input });
  }
  addNote(input: AddIssueNoteInput) {
    return this.run({ type: 'ADD_NOTE', input });
  }
  createReplacement(input: IssueTransitionInput) {
    return this.run({ type: 'CREATE_REPLACEMENT', input });
  }
  setProcedure(input: SetDeliveryProcedureInput) {
    return this.run({ type: 'SET_PROCEDURE', input });
  }
  async getReceiptContext(requestId: string): Promise<DeliveryReceiptContextDto> {
    const request = await this.requests.getRequest(requestId);
    if (!request.delivery) throw new Error('Delivery information unavailable.');
    return { request, summary: request.delivery, procedures: await this.getProcedures(requestId) };
  }
  async getProcedures(requestId: string): Promise<DeliveryProcedureDto[]> {
    let procedures: DeliveryProcedureDto[];
    try {
      procedures = (
        await httpsCallable<{ requestId: string; kinds: string[] }, DeliveryProcedureDto[]>(
          this.firebase.functions,
          'getDeliveryProcedures',
        )({ requestId, kinds: ['DAMAGED', 'MISSING'] })
      ).data;
    } catch (error) {
      const parsed = commandError(error);
      if (['FORBIDDEN', 'UNAUTHENTICATED'].includes(parsed.code)) throw parsed;
      procedures = (['DAMAGED', 'MISSING'] as const).map((kind) => ({
        kind,
        documentId: null,
        revision: 0,
        availability: 'UNAVAILABLE',
        reference: null,
        title: null,
      }));
    }
    return procedures;
  }
  async getIssue(issueId: string, page: { eventOffset?: number; replacementOffset?: number } = {}) {
    const eventOffset = page.eventOffset ?? 0,
      replacementOffset = page.replacementOffset ?? 0,
      limit = 20;
    const { data } = await sdk.getDeliveryIssue(
      this.firebase.data,
      { issueId, eventLimit: limit, eventOffset, replacementLimit: limit, replacementOffset },
      policy,
    );
    const issue = data.membership?.business.issues[0];
    if (!issue) throw new Error('Delivery issue unavailable.');
    return toDeliveryIssue(issue, eventOffset, replacementOffset, limit);
  }
  async listIssues(input: {
    salonId?: string;
    offset: number;
    limit: number;
    status: 'OPEN' | 'ALL';
  }): Promise<DeliveryIssuePageDto> {
    const { data } = await sdk.listDeliveryIssues(
      this.firebase.data,
      {
        allSalons: !input.salonId,
        salonId: input.salonId ?? null,
        statuses:
          input.status === 'ALL'
            ? Object.values(sdk.DeliveryIssueStatus)
            : [
                sdk.DeliveryIssueStatus.OPEN,
                sdk.DeliveryIssueStatus.IN_REVIEW,
                sdk.DeliveryIssueStatus.REPLACEMENT_IN_PROGRESS,
              ],
        limit: input.limit,
        offset: input.offset,
      },
      policy,
    );
    const business = data.membership?.business;
    if (!business) throw new Error('Delivery issues unavailable.');
    const rows = business.issues ?? business.salonIssues ?? [],
      counts = business.openCounts ?? business.salonOpenCounts ?? [];
    return {
      items: rows.map(toDeliveryIssueSummary),
      offset: input.offset,
      hasMore: rows.length === input.limit,
      openCount: counts[0]?._count ?? 0,
    };
  }
  async getProcedureBindings(): Promise<DeliveryProcedureDto[]> {
    return toProcedureBindings(
      (await sdk.getDeliveryProcedureBindings(this.firebase.data, policy)).data,
    );
  }
  async listProcedureDocuments(page: PageInput): Promise<Page<DeliveryProcedureOption>> {
    const { data } = await sdk.listDeliveryProcedureDocuments(this.firebase.data, page, policy);
    const rows = data.membership?.business.documents;
    if (!rows) throw new Error('Published procedures unavailable.');
    return {
      items: rows
        .filter((row) => row.document.activeVersionId === row.id)
        .map((row) => ({
          documentId: row.documentId,
          title: row.title,
          documentCode: row.document.documentCode,
        })),
      nextOffset: rows.length === page.limit ? page.offset + page.limit : null,
    };
  }
}
