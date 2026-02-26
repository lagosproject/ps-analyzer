import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

export interface ProxyConfig {
    http_proxy?: string;
    https_proxy?: string;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private readonly http = inject(HttpClient);
    private readonly STORAGE_KEY = 'ms_analyzer_proxy_config';

    async applyProxyConfig(config: ProxyConfig): Promise<void> {
        try {
            await firstValueFrom(this.http.post(`${API_CONFIG.baseUrl}/config/proxy`, config));
            console.log('Proxy configuration applied to backend:', config);
        } catch (e) {
            console.error('Failed to apply proxy config to backend', e);
        }
    }

    saveProxyConfig(config: ProxyConfig): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    }

    getProxyConfig(): ProxyConfig {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                return JSON.parse(data) as ProxyConfig;
            } catch {
                return {};
            }
        }
        return {};
    }
}
