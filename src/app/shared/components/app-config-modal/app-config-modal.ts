import { Component, ChangeDetectionStrategy, model, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { SettingsService, ProxyConfig } from '../../../core/services/settings.service';
import { UserService } from '../../../core/services/user.service';
import { AnalysisService } from '../../../core/services/analysis.service';
import { OCStatus, OCModule, OCInstallTask } from '../../../core/models/analysis.model';


const DEFAULT_MODULES = new Set([
    'base',
    'cravat-converter',
    'excelreporter',
    'textreporter',
    'vcf-converter',
    'pi-converter',
    'trio-converter',
    'webviewer',
    'webviewerwidget',
    'template-reporter',
    'tags',
    'crm',
    'oldcravat-converter'
]);

@Component({
    selector: 'app-config-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, TranslatePipe],
    templateUrl: './app-config-modal.html',
    styleUrl: './app-config-modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppConfigModalComponent implements OnInit {
    private settingsService = inject(SettingsService);
    private analysisService = inject(AnalysisService);
    protected userService = inject(UserService);
    protected translate = inject(TranslateService);

    proxyConfig: ProxyConfig = {};
    userName = signal<string>('');
    ocPath = signal<string>('');
    activeTab = model<string>('General');
    showAdvanced = signal<boolean>(false);

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

    // Helper computed properties to filter out core/default-installed modules and keep only annotators
    nonDefaultInstalledModules = computed(() => {
        return this.installedModules().filter(m => 
            m.type === 'annotator' && !DEFAULT_MODULES.has(m.name.toLowerCase())
        );
    });

    nonDefaultStoreModules = computed(() => {
        return this.storeModules().filter(m => 
            m.type === 'annotator' && !DEFAULT_MODULES.has(m.name.toLowerCase())
        );
    });

    // Filtered lists based on search query
    filteredInstalledModules = computed(() => {
        const query = this.ocSearchQuery().toLowerCase().trim();
        const modules = this.nonDefaultInstalledModules();
        if (!query) return modules;
        return modules.filter(m => 
            m.name.toLowerCase().includes(query) || 
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.type && m.type.toLowerCase().includes(query))
        );
    });

    filteredStoreModules = computed(() => {
        const query = this.ocSearchQuery().toLowerCase().trim();
        const modules = this.nonDefaultStoreModules();
        if (!query) return modules;
        return modules.filter(m => 
            m.name.toLowerCase().includes(query) || 
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.type && m.type.toLowerCase().includes(query))
        );
    });

    frontendVersion = '0.2.0';
    bioEngineVersion = signal<string>('Loading...');

    /** Controls the visibility of the modal. */
    isVisible = model<boolean>(false);

    ngOnInit() {
        this.proxyConfig = this.settingsService.getProxyConfig();
        this.userName.set(this.userService.getUserName() || '');
        this.ocPath.set(this.settingsService.getOCPath() || '');
        this.settingsService.getBioEngineVersion().then(v => {
            this.bioEngineVersion.set(v);
        });
    }

    setActiveTab(tab: string) {
        this.activeTab.set(tab);
        if (tab === 'Local Annotator') {
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
        
        const path = this.ocPath().trim();
        this.settingsService.saveOCPath(path);
        this.settingsService.applyOCPath(path);

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
        if (confirm(this.translate.instant('appConfig.confirmFlushCache'))) {
            try {
                await this.analysisService.flushCache();
                alert(this.translate.instant('appConfig.cacheCleared'));
            } catch (error: unknown) {
                alert(this.translate.instant('appConfig.failedClearCache', { error: (error as any).message }));
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
            await this.settingsService.applyOCPath(this.ocPath().trim());
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
            alert(this.translate.instant('appConfig.failedStartInstall', { name: moduleName, error: e.message }));
        }
    }
 
    /**
     * Uninstalls an OpenCRAVAT module.
     */
    async uninstallModule(moduleName: string) {
        if (!confirm(this.translate.instant('appConfig.confirmUninstallModule', { name: moduleName }))) {
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
                alert(this.translate.instant('appConfig.failedUninstallModule', { error: res.error }));
            }
        } catch (e: any) {
            alert(this.translate.instant('appConfig.failedUninstallModule', { error: e.message }));
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
