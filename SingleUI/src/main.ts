import { inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './selected-app';
import { SystemPreferences } from './preferences/system-preferences';

bootstrapApplication(App, {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      inject(SystemPreferences);
    }),
  ],
}).catch((err) => console.error(err));
