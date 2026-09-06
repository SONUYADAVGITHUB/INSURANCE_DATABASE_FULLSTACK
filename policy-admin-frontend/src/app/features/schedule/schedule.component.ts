import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleService } from '../../core/services/schedule.service';
import { ScheduledJob } from '../../core/models/policy.model';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss'
})
export class ScheduleComponent {
  private scheduleService = inject(ScheduleService);

  message = '';
  day = '';
  time = '';

  fieldError = signal<string | null>(null);
  submitting = signal(false);
  error = signal<string | null>(null);
  loading = signal(true);
  jobs = signal<ScheduledJob[]>([]);

  constructor() {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    this.scheduleService.list().subscribe({
      next: (res) => {
        this.jobs.set(res.jobs || []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Couldn't load scheduled messages. Confirm the API is running.");
        this.loading.set(false);
      }
    });
  }

  submit(): void {
    const msg = this.message.trim();

    if (!msg) {
      this.fieldError.set('Enter a message.');
      return;
    }
    if (!DAY_RE.test(this.day)) {
      this.fieldError.set('Day must be in YYYY-MM-DD format.');
      return;
    }
    if (!TIME_RE.test(this.time)) {
      this.fieldError.set('Time must be 24-hour HH:mm, e.g. 14:30.');
      return;
    }

    this.fieldError.set(null);
    this.error.set(null);
    this.submitting.set(true);

    this.scheduleService.schedule(msg, this.day, this.time).subscribe({
      next: (res) => {
        this.jobs.update((list) => [res.job, ...list]);
        this.submitting.set(false);
        this.message = '';
        this.day = '';
        this.time = '';
      },
      error: (err) => {
        this.error.set(err?.error?.error || "Couldn't reach the API. Confirm the server is running.");
        this.submitting.set(false);
      }
    });
  }
}
