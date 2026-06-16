import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastComponent } from './shared/components/toast/toast.component';
import { UserModalComponent } from './shared/components/user-modal/user-modal.component';
import { UserService } from './core/services/user.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastComponent, UserModalComponent],

  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  protected readonly userService = inject(UserService);
  private readonly translate = inject(TranslateService);

  constructor() {
    const supportedLangs = ['en', 'es', 'fr'];
    this.translate.addLangs(supportedLangs);

    let detectedLang = 'en';
    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
      if (lang) {
        const baseLang = lang.split('-')[0].toLowerCase();
        if (supportedLangs.includes(baseLang)) {
          detectedLang = baseLang;
          break;
        }
      }
    }

    this.translate.use(detectedLang);
  }
}