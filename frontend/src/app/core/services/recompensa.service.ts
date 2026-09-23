import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RecompensaService {
  private http = inject(HttpClient);
  private get apiUrl(): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    return `${base}/api/recompensas`;
  }

  getRecompensas(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  canjearRecompensa(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/canjear`, {});
  }
}
