import { Component, ChangeDetectionStrategy, model, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, ProxyConfig } from '../../../core/services/settings.service';
import { UserService } from '../../../core/services/user.service';


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
    protected userService = inject(UserService);

    proxyConfig: ProxyConfig = {};
    userName = signal<string>('');


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

}
