import { Service, inject } from '@angular/core';
import { callFunction } from '../../../core/call-function';
import { FIREBASE } from '../../../core/firebase.providers';
import type { AppLanguage } from '../../../core/models/app-language';

@Service()
export class PushApi {
  private readonly firebase = inject(FIREBASE);

  async register(token: string, locale: AppLanguage): Promise<void> {
    await callFunction(this.firebase, 'registerPushToken', { token, locale });
  }

  async unregister(token: string): Promise<void> {
    await callFunction(this.firebase, 'unregisterPushToken', { token });
  }
}
