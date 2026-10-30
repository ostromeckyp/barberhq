import type { TranslatedText } from '../../../core/models/translated-text';
import type { CommandResult } from '../../../../../../shared/contracts/stock/index';

export type ActionOutcome = { result?: CommandResult; error?: TranslatedText };
