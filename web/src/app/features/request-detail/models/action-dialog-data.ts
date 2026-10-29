import type { RequestDetail } from '../../../../../../shared/contracts/stock/index';
import type { TransitionType } from './transition-type';

export type ActionDialogData = { request: RequestDetail; type: TransitionType };
