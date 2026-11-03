import { createSessionGateway } from './features/auth/data-access/firebase-session.gateway';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { routes } from './app.routes';
import { ClientLog } from './core/client-log';
import { LoggingErrorHandler } from './core/logging-error-handler';
import { runtimeConfig } from './core/public-config';
import { FIREBASE } from './core/firebase.providers';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { provideI18n } from './core/i18n/i18n.providers';
import { SESSION_GATEWAY } from './features/auth/data-access/session.gateway';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: LoggingErrorHandler },
    // Started at boot so events kept from an earlier (offline) session are sent.
    provideAppInitializer(() => void inject(ClientLog)),
    provideRouter(routes, withComponentInputBinding()),
    provideI18n(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !runtimeConfig.useEmulators,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    { provide: SESSION_GATEWAY, useFactory: createSessionGateway, deps: [FIREBASE] },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
