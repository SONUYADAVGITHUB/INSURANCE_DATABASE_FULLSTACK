import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PolicyService } from '../../core/services/policy.service';
import { SystemService } from '../../core/services/system.service';
import { UploadSummary, SystemStatus } from '../../core/models/policy.model';

const STALE_AFTER_MS = 8000;

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss'
})
export class ImportComponent {
  private policyService = inject(PolicyService);
  private systemService = inject(SystemService);
  private destroyRef = inject(DestroyRef);
  private staleTimer: ReturnType<typeof setTimeout> | null = null;

  file = signal<File | null>(null);
  dragging = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  summary = signal<UploadSummary | null>(null);

  // --- live CPU, so the spike from THIS upload is visible in real time ---
  cpuStatus = signal<SystemStatus | null>(null);
  cpuLive = signal(false);
  cpuPeak = signal(0);

  constructor() {
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

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0] ?? null;
    this.setFile(picked);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files?.[0] ?? null;
    this.setFile(dropped);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  private setFile(candidate: File | null): void {
    this.summary.set(null);
    this.error.set(null);

    if (!candidate) {
      this.file.set(null);
      return;
    }
    if (!/\.(csv|xlsx|xls)$/i.test(candidate.name)) {
      this.error.set('Only .csv, .xlsx, or .xls files are accepted.');
      this.file.set(null);
      return;
    }
    this.file.set(candidate);
  }

  upload(): void {
    const current = this.file();
    if (!current) {
      this.error.set('Choose a file first.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.summary.set(null);
    // Reset the peak right as the upload starts, so what's shown once it
    // finishes reflects THIS upload's CPU spike, not an earlier one.
    this.cpuPeak.set(this.cpuStatus()?.cpuPercent ?? 0);

    this.policyService.upload(current).subscribe({
      next: (res) => {
        this.summary.set(res.summary);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error || "Import failed. Confirm the API and MongoDB are both running.");
        this.loading.set(false);
      }
    });
  }

  reset(): void {
    this.file.set(null);
    this.summary.set(null);
    this.error.set(null);
  }

  private resetStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => this.cpuLive.set(false), STALE_AFTER_MS);
  }
}