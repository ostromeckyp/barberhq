import type { StockAction } from '../../../../../../shared/contracts/stock/index';

export type TransitionType = Exclude<StockAction['type'], 'SUBMIT'>;
