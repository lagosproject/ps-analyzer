import { Component, ChangeDetectionStrategy, model, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, ProxyConfig } from '../../../core/services/settings.service';
import { UserService } from '../../../core/services/user.service';
import { AnalysisService } from '../../../core/services/analysis.service';
import { OCStatus, OCModule, OCInstallTask } from '../../../core/models/analysis.model';


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
    activeTab = model<string>('General');

    // OpenCRAVAT State
    ocStatus = signal<OCStatus | null>(null);
    installedModules = signal<OCModule[]>([]);
    storeModules = signal<OCModule[]>([]);
    isLoading = signal<boolean>(false);
    ocTab = signal<'installed' | 'store'>('installed');
    ocSearchQuery = signal<string>('');
    activeTasks = this.analysisService.activeTasks;

    activeInstallingTasks = computed(() => {
        return Object.values(this.activeTasks()).filter(
            t => t.status === 'pending' || t.status === 'running'
        );
    });

    // Filtered lists based on search query
    filteredInstalledModules = computed(() => {
        const query = this.ocSearchQuery().toLowerCase().trim();
        const modules = this.installedModules();
        if (!query) return modules;
        return modules.filter(m => 
            m.name.toLowerCase().includes(query) || 
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.type && m.type.toLowerCase().includes(query))
        );
    });

    filteredStoreModules = computed(() => {
        const query = this.ocSearchQuery().toLowerCase().trim();
        const modules = this.storeModules();
        if (!query) return modules;
        return modules.filter(m => 
            m.name.toLowerCase().includes(query) || 
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.type && m.type.toLowerCase().includes(query))
        );
    });

    /** Controls the visibility of the modal. */
    isVisible = model<boolean>(false);

    ngOnInit() {
        this.proxyConfig = this.settingsService.getProxyConfig();
        this.userName.set(this.userService.getUserName() || '');
    }

    setActiveTab(tab: string) {
        this.activeTab.set(tab);
        if (tab === 'OpenCRAVAT') {
            this.loadOCInfo();
            this.analysisService.loadAndPollActiveTasks(async () => {
                await this.loadOCInfo();
                if (this.ocTab() === 'store') {
                    await this.loadStore();
                }
            });
        }
    }

    /**
     * Changes OpenCRAVAT sub-tabs (Installed vs Store).
     */
    setOCTab(tab: 'installed' | 'store') {
        this.ocTab.set(tab);
        if (tab === 'store' && this.storeModules().length === 0) {
            this.loadStore();
        }
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
            } catch (error: unknown) {
                alert('Failed to clear cache: ' + (error as any).message);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // OpenCRAVAT Management Methods
    // ---------------------------------------------------------------------------

    /**
     * Fetches OpenCRAVAT overall status and installed modules.
     */
    async loadOCInfo() {
        this.isLoading.set(true);
        try {
            const status = await this.analysisService.getOCStatus();
            this.ocStatus.set(status);
            if (status.installed) {
                const modules = await this.analysisService.getOCModules();
                this.installedModules.set(modules);
            }
        } catch (e: any) {
            console.error("Failed to load OpenCRAVAT status:", e);
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Loads the module listing from the OpenCRAVAT store.
     */
    async loadStore() {
        this.isLoading.set(true);
        try {
            const modules = await this.analysisService.getOCStoreModules();
            this.storeModules.set(modules);
        } catch (e: any) {
            console.error("Failed to load OpenCRAVAT store:", e);
        } finally {
            this.isLoading.set(false);
        }
    }

    async installModule(moduleName: string) {
        try {
            const task = await this.analysisService.installOCModule(moduleName);
            this.activeTasks.update(tasks => ({
                ...tasks,
                [task.task_id]: task
            }));
            this.analysisService.pollTask(task.task_id, async () => {
                const currentTask = this.activeTasks()[task.task_id];
                if (currentTask && (currentTask.status === 'completed' || currentTask.status === 'failed')) {
                    await this.loadOCInfo();
                    if (this.ocTab() === 'store') {
                        await this.loadStore();
                    }
                }
            });
        } catch (e: any) {
            alert(`Failed to start installation for ${moduleName}: ` + e.message);
        }
    }

    /**
     * Uninstalls an OpenCRAVAT module.
     */
    async uninstallModule(moduleName: string) {
        if (!confirm(`Are you sure you want to uninstall module "${moduleName}"?`)) {
            return;
        }
        this.isLoading.set(true);
        try {
            const res = await this.analysisService.uninstallOCModule(moduleName);
            if (res.success) {
                await this.loadOCInfo();
                if (this.ocTab() === 'store') {
                    await this.loadStore();
                }
            } else {
                alert(`Failed to uninstall module: ${res.error}`);
            }
        } catch (e: any) {
            alert(`Failed to uninstall module: ` + e.message);
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Helper to get active task for a module if it exists.
     */
    getModuleTask(moduleName: string): OCInstallTask | undefined {
        return Object.values(this.activeTasks()).find(
            task => task.module === moduleName && (task.status === 'pending' || task.status === 'running')
        );
    }

    /**
     * Formats bytes to human-readable string.
     */
    formatSize(bytes?: number): string {
        if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}
