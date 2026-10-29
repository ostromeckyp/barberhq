import type { Membership } from '../../../../../../shared/contracts/business/index';
import type { SalonOption } from './salon-option';

export interface ResolvedMember {
  membership: Membership;
  salons: SalonOption[];
}
