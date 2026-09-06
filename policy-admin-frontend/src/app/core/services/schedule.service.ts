import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ScheduledJob } from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  schedule(message: string, day: string, time: string): Observable<{ message: string; job: ScheduledJob }> {
    return this.http.post<{ message: string; job: ScheduledJob }>(`${this.base}/messages/schedule`, {
      message,
      day,
      time
    });
  }

  list(): Observable<{ jobs: ScheduledJob[] }> {
    return this.http.get<{ jobs: ScheduledJob[] }>(`${this.base}/messages`);
  }
}
