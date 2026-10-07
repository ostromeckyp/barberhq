import { Service, inject, signal } from '@angular/core';
import { QueryFetchPolicy } from 'firebase/data-connect';
import { FIREBASE } from '../../../core/firebase.providers';
import { getSalonSettings, saveSalonSettings } from '../../../core/generated';
import type {
  SalonSettings,
  SaveSalonSettingsInput,
} from '../../../../../../shared/contracts/settings';
export class SettingsSaveError extends Error {
  constructor(readonly code: 'STALE_STATE' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'UNKNOWN') {
    super(code);
  }
}
@Service()
export class SalonSettingsApi {
  private readonly firebase = inject(FIREBASE);
  private readonly changed = signal(0);
  readonly revision = this.changed.asReadonly();
  async get(salonId: string): Promise<SalonSettings> {
    const row = (
      await getSalonSettings(
        this.firebase.data,
        { salonId },
        { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
      )
    ).data.settings;
    if (!row) throw Error('Salon settings are not configured. Contact HQ.');
    return row;
  }
  async save(input: SaveSalonSettingsInput): Promise<SalonSettings> {
    try {
      const row = (await saveSalonSettings(this.firebase.data, input)).data.result?.settings;
      if (!row) throw Error('Missing authoritative settings');
      this.changed.update((n) => n + 1);
      return row;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      throw new SettingsSaveError(
        message.includes('STALE_STATE')
          ? 'STALE_STATE'
          : message.includes('FORBIDDEN')
            ? 'FORBIDDEN'
            : message.includes('VALIDATION')
              ? 'VALIDATION_ERROR'
              : 'UNKNOWN',
      );
    }
  }
}
