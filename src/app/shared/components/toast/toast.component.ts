import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

/**
 * Toast notification component.
 * Subscribes to the ToastService to display and auto-clear messages.
 */
@Component({
    selector: 'app-toast',
    standalone: true,
    imports: [CommonModule],
    template: `
        @for (t of [toastService.toast()]; track t?.id) {
            @if (t) {
            <div class="toast-card" [class]="t.type || 'info'">
                <div class="toast-content">{{ t.text }}</div>
                <button class="toast-close" (click)="toastService.clear()">×</button>
            </div>
            }
        }
    `,
    styles: [`
        .toast-card {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            padding: 0.75rem 1.25rem;
            border-radius: 8px;
            background: #fff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 9999;
            min-width: 300px;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            font-size: 0.9rem;
            border: 1px solid rgba(0,0,0,0.1);
        }

        .toast-card.success {
            border-left: 4px solid #10B981;
        }

        .toast-card.error {
            border-left: 4px solid #EF4444;
        }

        .toast-card.info {
            border-left: 4px solid #3B82F6;
        }

        .toast-content {
            flex: 1;
            color: #1F2937;
            font-weight: 500;
        }

        .toast-close {
            background: none;
            border: none;
            color: #9CA3AF;
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
            padding: 0 4px;
            transition: color 0.2s;
        }

        .toast-close:hover {
            color: #4B5563;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translate(-50%, 20px);
            }
            to {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }

        @media print {
            .toast-card {
                display: none !important;
            }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastComponent {
    /** Service managing toast notifications state. */
    protected readonly toastService = inject(ToastService);
}
