import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SystemStatus } from '../models/policy.model';

const RECONNECT_DELAY_MS = 3000;

@Injectable({ providedIn: 'root' })
export class SystemService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  /** One-off fetch - GET /api/system/status. */
  status(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(`${this.base}/system/status`);
  }

  /**
   * Live feed over WebSocket (ws://.../ws/system). Emits a new
   * SystemStatus every time the server takes a CPU sample, so the UI
   * updates in real time instead of polling. Auto-reconnects with a
   * fixed delay if the connection drops; the returned observable never
   * completes on its own, so the caller should unsubscribe (e.g. via
   * `takeUntilDestroyed()`) when the consuming component is destroyed.
   */
  liveStatus$(): Observable<SystemStatus> {
    return new Observable<SystemStatus>((subscriber) => {
      let socket: WebSocket | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let closedByUnsubscribe = false;

      const connect = () => {
        socket = new WebSocket(this.wsUrl());

        socket.onmessage = (event) => {
          try {
            subscriber.next(JSON.parse(event.data) as SystemStatus);
          } catch {
            // Ignore a malformed frame rather than tearing down the feed.
          }
        };

        socket.onclose = () => {
          if (closedByUnsubscribe) return;
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        };

        socket.onerror = () => {
          // onclose fires right after onerror for a failed connection, so
          // the reconnect is scheduled there - nothing extra to do here.
        };
      };

      connect();

      return () => {
        closedByUnsubscribe = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        socket?.close();
      };
    });
  }

  private wsUrl(): string {
    if (environment.wsBaseUrl) return `${environment.wsBaseUrl}/ws/system`;
    // Production fallback: same host the app was served from, over wss:// if https.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/system`;
  }
}
