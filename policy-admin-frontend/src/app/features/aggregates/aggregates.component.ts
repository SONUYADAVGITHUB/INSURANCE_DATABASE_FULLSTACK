import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PolicyService } from '../../core/services/policy.service';
import { AggregateUserResult } from '../../core/models/policy.model';

@Component({
  selector: 'app-aggregates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aggregates.component.html',
  styleUrl: './aggregates.component.scss'
})
export class AggregatesComponent {
  private policyService = inject(PolicyService);

  loading = signal(true);
  error = signal<string | null>(null);
  users = signal<AggregateUserResult[]>([]);
  filter = signal('');
  expanded = signal<Set<string>>(new Set());

  filtered = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const sorted = [...this.users()].sort((a, b) => (b.premiumTotal || 0) - (a.premiumTotal || 0));
    if (!term) return sorted;
    return sorted.filter((u) => u.firstname?.toLowerCase().includes(term));
  });

  constructor() {
    this.load();
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
        this.error.set("Couldn't reach the API. Confirm the server is running.");
        this.loading.set(false);
      }
    });
  }

  isExpanded(userId: string): boolean {
    return this.expanded().has(userId);
  }

  toggle(userId: string): void {
    const next = new Set(this.expanded());
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    this.expanded.set(next);
  }
}
