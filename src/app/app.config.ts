import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // New screens open at the top; back/forward restores where you were.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))
  ]
};
