import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PolicyService } from '../../core/services/policy.service';
import { Policy, PolicyUser } from '../../core/models/policy.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {
  private policyService = inject(PolicyService);

  firstname = '';
  email = '';

  fieldError = signal<string | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  searched = signal(false);
  users = signal<PolicyUser[]>([]);
  policies = signal<Policy[]>([]);

  policiesFor(userId: string): Policy[] {
    return this.policies().filter((p) => p.user_id === userId);
  }

  submit(): void {
    const name = this.firstname.trim();
    if (!name) {
      this.fieldError.set('Enter a first name to search.');
      return;
    }
    this.fieldError.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.searched.set(true);

    this.policyService.search(name, this.email.trim() || undefined).subscribe({
      next: (res) => {
        this.users.set(res.users || []);
        this.policies.set(res.policies || []);
        this.loading.set(false);
      },
      error: (err) => {
        if (err.status === 404) {
          this.users.set([]);
          this.policies.set([]);
        } else {
          this.error.set("Couldn't reach the API. Confirm the server is running.");
        }
        this.loading.set(false);
      }
    });
  }
}
