import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PolicyService } from '../../core/services/policy.service';
import { AggregateUserResult } from '../../core/models/policy.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private policyService = inject(PolicyService);

  loading = signal(true);
  error = signal<string | null>(null);
  users = signal<AggregateUserResult[]>([]);

  totalUsers = computed(() => this.users().length);
  totalPolicies = computed(() => this.users().reduce((sum, u) => sum + (u.policyCount || 0), 0));
  totalPremium = computed(() => this.users().reduce((sum, u) => sum + (u.premiumTotal || 0), 0));

  topUsers = computed(() =>
    [...this.users()].sort((a, b) => (b.premiumTotal || 0) - (a.premiumTotal || 0)).slice(0, 6)
  );

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
        this.error.set("Couldn't reach the API. Confirm the server is running and MongoDB has data imported.");
        this.loading.set(false);
      }
    });
  }
}
