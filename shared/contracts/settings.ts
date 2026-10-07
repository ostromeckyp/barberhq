export interface SalonSettings {
  salonId: string;
  lowStockThreshold: number;
  version: number;
  updatedAt: string;
}
export interface SaveSalonSettingsInput {
  salonId: string;
  lowStockThreshold: number;
  expectedVersion: number;
}
