import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchResponse, AggregateUserResult, UploadSummary } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  upload(file: File): Observable<{ message: string; summary: UploadSummary }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ message: string; summary: UploadSummary }>(`${this.base}/upload`, form);
  }

  search(firstname: string, email?: string): Observable<SearchResponse> {
    const params: Record<string, string> = { firstname };
    if (email) params['email'] = email;
    return this.http.get<SearchResponse>(`${this.base}/policies/search`, { params });
  }

  aggregateAll(): Observable<{ users: AggregateUserResult[] }> {
    return this.http.get<{ users: AggregateUserResult[] }>(`${this.base}/policies/aggregate`);
  }

  aggregateByUser(userId: string): Observable<AggregateUserResult> {
    return this.http.get<AggregateUserResult>(`${this.base}/policies/aggregate/${userId}`);
  }
}
