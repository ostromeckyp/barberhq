import { createSessionGateway } from './features/auth/data-access/firebase-session.gateway';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { routes } from './app.routes';
import { FIREBASE } from './core/firebase.providers';
import { provideI18n } from './core/i18n/i18n.providers';
import { SESSION_GATEWAY } from './features/auth/data-access/session.gateway';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideI18n(),
    { provide: SESSION_GATEWAY, useFactory: createSessionGateway, deps: [FIREBASE] },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
