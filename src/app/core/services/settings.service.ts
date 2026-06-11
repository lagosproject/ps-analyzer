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

    private readonly OC_PATH_KEY = 'ms_analyzer_oc_path';

    constructor() {
        this.applySavedSettings();
    }

    private async applySavedSettings(): Promise<void> {
        const proxy = this.getProxyConfig();
        if (proxy.http_proxy || proxy.https_proxy) {
            this.applyProxyConfig(proxy);
        }
        const ocPath = this.getOCPath();
        if (ocPath) {
            this.applyOCPath(ocPath);
        }
    }

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

    async applyOCPath(ocPath: string): Promise<void> {
        try {
            await firstValueFrom(this.http.post(`${API_CONFIG.baseUrl}/config/opencravat`, { oc_path: ocPath }));
            console.log('OpenCRAVAT path configuration applied to backend:', ocPath);
        } catch (e) {
            console.error('Failed to apply OpenCRAVAT path to backend', e);
        }
    }

    saveOCPath(ocPath: string): void {
        localStorage.setItem(this.OC_PATH_KEY, ocPath);
    }

    getOCPath(): string {
        return localStorage.getItem(this.OC_PATH_KEY) || '';
    }

    async getBioEngineVersion(): Promise<string> {
        try {
            const res = await firstValueFrom(this.http.get<{ version: string }>(`${API_CONFIG.baseUrl}/version`));
            return res.version;
        } catch (e) {
            console.error('Failed to get bio-engine version', e);
            return 'Unknown (Offline/Unreachable)';
        }
    }
}
