import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PolicyService } from '../../core/services/policy.service';
import { SystemService } from '../../core/services/system.service';
import { AggregateUserResult, SystemStatus } from '../../core/models/policy.model';

// Same staleness window used on the /system page - if no sample arrives
// in this long, the live pill flips to "Reconnecting" instead of trusting
// a frozen last-known reading.
const STALE_AFTER_MS = 8000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private policyService = inject(PolicyService);
  private systemService = inject(SystemService);
  private destroyRef = inject(DestroyRef);
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  loading = signal(true);
  error = signal<string | null>(null);
  users = signal<AggregateUserResult[]>([]);

  totalUsers = computed(() => this.users().length);
  totalPolicies = computed(() => this.users().reduce((sum, u) => sum + (u.policyCount || 0), 0));
  totalPremium = computed(() => this.users().reduce((sum, u) => sum + (u.premiumTotal || 0), 0));

  topUsers = computed(() =>
    [...this.users()].sort((a, b) => (b.premiumTotal || 0) - (a.premiumTotal || 0)).slice(0, 6)
  );

  // --- live CPU, so you can watch it move while an upload is running ---
  cpuStatus = signal<SystemStatus | null>(null);
  cpuLive = signal(false);
  cpuPeak = signal(0);

  constructor() {
    this.load();

    this.systemService
      .liveStatus$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        this.cpuStatus.set(s);
        this.cpuLive.set(true);
        if (s.cpuPercent > this.cpuPeak()) this.cpuPeak.set(s.cpuPercent);
        this.resetStaleTimer();
      });

    this.destroyRef.onDestroy(() => {
      if (this.staleTimer) clearTimeout(this.staleTimer);
    });
  }

  resetPeak(): void {
    this.cpuPeak.set(this.cpuStatus()?.cpuPercent ?? 0);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.policyService.aggregateAll().subscribe({
      next: (res) => {
        this.users.set(res.users || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Couldn't reach the API. Confirm the server is running and MongoDB has data imported.");
        this.loading.set(false);
      }
    });
  }

  private resetStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.cpuLive.set(false), STALE_AFTER_MS);
  }
}