export interface Product {
  id: string;
  demoId: string;
  name: string;
  brand: string;
  category: string;
  summaryEn: string;
  scentPl: string | null;
  sourceCode: string;
  netContent: { value: number; unit: 'ml' };
  retailPriceGrosz: number;
  sourceUrl: string;
  observedOn: string;
  transferPackSize: null;
  packageDimensionsMm: null;
  shippingWeightGrams: null;
}
