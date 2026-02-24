import { Injectable, signal } from '@angular/core';

/**
 * Type of notification to display.
 */
export type ToastType = 'success' | 'info' | 'error' | 'warning';

/**
 * Structure of a toast notification message.
 */
export interface ToastMessage {
    /** Unique ID for the message */
    id: number;
    /** Text content to show */
    text: string;
    /** Visual style type */
    type: ToastType;
}

/**
 * Service for managing temporary user notifications (toasts).
 */
@Injectable({
    providedIn: 'root'
})
export class ToastService {
    /** Signal containing the current toast message or null */
    readonly currentToast = signal<ToastMessage | null>(null);

    /** Alias for currentToast signal for backward compatibility with existing templates */
    readonly toast = this.currentToast;

    /**
     * Shows a toast message that automatically disappears.
     * @param message - The text content to display
     * @param type - The stylistic type of the notification
     * @param duration - Time in ms before the toast vanishes (default: 3000)
     */
    show(message: string, type: ToastType = 'info', duration = 3000) {
        const id = Date.now();
        this.currentToast.set({ id, text: message, type });

        setTimeout(() => {
            // Only clear if this is still the active toast (prevents clearing newer messages)
            if (this.currentToast()?.id === id) {
                this.currentToast.set(null);
            }
        }, duration);
    }

    /**
     * Immediately clears the current toast notification.
     */
    clear() {
        this.currentToast.set(null);
    }
}
