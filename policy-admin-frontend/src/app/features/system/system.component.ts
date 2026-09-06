import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { SystemService } from '../../core/services/system.service';
import { SystemStatus } from '../../core/models/policy.model';

// If no new sample has arrived in this long, treat the feed as stale/
// disconnected rather than trusting a frozen last-known reading. The
// server samples roughly every CPU_SAMPLE_INTERVAL_MS (2000ms default);
// this is a generous multiple of that so normal network jitter doesn't
// flicker the indicator.
const STALE_AFTER_MS = 8000;

@Component({
  selector: 'app-system',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './system.component.html',
  styleUrl: './system.component.scss'
})
export class SystemComponent {
  private systemService = inject(SystemService);
  private destroyRef = inject(DestroyRef);
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  status = signal<SystemStatus | null>(null);
  live = signal(false);

  constructor() {
    this.systemService
      .liveStatus$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        this.status.set(s);
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
