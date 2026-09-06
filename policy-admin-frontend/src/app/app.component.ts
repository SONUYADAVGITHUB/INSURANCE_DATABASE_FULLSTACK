import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { SystemService } from './core/services/system.service';
import { SystemStatus } from './core/models/policy.model';

const STALE_AFTER_MS = 8000;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private systemService = inject(SystemService);
  private destroyRef = inject(DestroyRef);
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  apiBase = environment.apiBaseUrl;
  liveStatus = signal<SystemStatus | null>(null);
  live = signal(false);

  constructor() {
    this.systemService
      .liveStatus$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        this.liveStatus.set(s);
        this.live.set(true);
        this.resetStaleTimer();
      });

    this.destroyRef.onDestroy(() => {
      if (this.staleTimer) clearTimeout(this.staleTimer);
    });
  }

  private resetStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.live.set(false), STALE_AFTER_MS);
  }
}
