export type SalonShorthand = {
  id: string;
  salonId: string;
  salonName: string;
  productId: string;
  productName: string;
  phrase: string;
  revision: number;
  status: 'active' | 'retired';
  updatedAt: string;
};
