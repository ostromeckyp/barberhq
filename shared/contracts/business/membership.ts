export interface Membership {
  userId: string;
  businessId: string;
  role: 'HQ' | 'SALON';
  salonIds: string[];
}
