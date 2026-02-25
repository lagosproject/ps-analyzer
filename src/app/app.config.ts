import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  provideAppInitializer
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient } from '@angular/common/http';
import { invoke } from '@tauri-apps/api/core';
import { API_CONFIG } from './core/config/api.config';

import { routes } from "./app.routes";

export async function initializeApp() {
  try {
    const port: number = await invoke('get_backend_port');
    if (port) {
      API_CONFIG.baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Backend port dynamically set to ${port}`);
    }
  } catch (e) {
    console.warn('Could not fetch dynamic backend port (Not running in Tauri?). Defaulting to 8000.', e);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer(initializeApp)
  ],
};
