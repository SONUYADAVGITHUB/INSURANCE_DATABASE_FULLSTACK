import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PolicyService } from '../../core/services/policy.service';
import { UploadSummary } from '../../core/models/policy.model';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss'
})
export class ImportComponent {
  private policyService = inject(PolicyService);

  file = signal<File | null>(null);
  dragging = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  summary = signal<UploadSummary | null>(null);

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
}
