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

      // Apply saved proxy config to the backend if any
      const proxyDataStr = localStorage.getItem('ms_analyzer_proxy_config');
      if (proxyDataStr) {
        try {
          const config = JSON.parse(proxyDataStr);
          if (config.http_proxy || config.https_proxy) {
            await fetch(`${API_CONFIG.baseUrl}/config/proxy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config)
            });
            console.log('Applied saved proxy configuration to bio-engine.');
          }
        } catch (e) {
          console.error('Failed to parse or apply proxy on startup', e);
        }
      }
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
