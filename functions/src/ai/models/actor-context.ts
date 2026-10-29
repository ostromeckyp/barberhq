export type ActorContext = Readonly<{
  uid: string;
  businessId: string;
  role: 'HQ' | 'SALON';
  salonIds: readonly string[];
}>;
