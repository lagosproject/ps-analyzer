import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-sanger-loader',
    standalone: true,
    imports: [],
    templateUrl: './loader.component.html',
    styleUrl: './loader.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SangerLoaderComponent {
    /** Message to display below the loader animation. */
    message = input<string>('Processing...');

    /** Optional progress percentage (0-100) to display. */
    progress = input<number | null>(null);
}
