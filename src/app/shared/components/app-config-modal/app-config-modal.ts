import { Component, ChangeDetectionStrategy, model, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, ProxyConfig } from '../../../core/services/settings.service';
import { UserService } from '../../../core/services/user.service';
import { AnalysisService } from '../../../core/services/analysis.service';


@Component({
    selector: 'app-config-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './app-config-modal.html',
    styleUrl: './app-config-modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppConfigModalComponent implements OnInit {
    private settingsService = inject(SettingsService);
    private analysisService = inject(AnalysisService);
    protected userService = inject(UserService);

    proxyConfig: ProxyConfig = {};
    userName = signal<string>('');
    activeTab = signal<string>('General');


    /** Controls the visibility of the modal. */
    isVisible = model<boolean>(false);

    ngOnInit() {
        this.proxyConfig = this.settingsService.getProxyConfig();
        this.userName.set(this.userService.getUserName() || '');
    }


    /**
     * Closes the app config modal and saves proxy config.
     */
    close() {
        this.settingsService.saveProxyConfig(this.proxyConfig);
        this.settingsService.applyProxyConfig(this.proxyConfig);
        
        const newName = this.userName().trim();
        if (newName) {
            this.userService.setUserName(newName);
        }

        this.isVisible.set(false);
    }

    /**
     * Flushes the global annotation cache.
     */
    async flushCache() {
        if (confirm('Are you sure you want to clear the global annotation cache? This will delete all cached VEP and HGVS results for all users.')) {
            try {
                await this.analysisService.flushCache();
                alert('Cache cleared successfully.');
            } catch (error: any) {
                alert('Failed to clear cache: ' + error.message);
            }
        }
    }
}
