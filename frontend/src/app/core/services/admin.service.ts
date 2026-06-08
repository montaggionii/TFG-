import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminMetricMap {
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/admin`;

  getDashboard(): Observable<AdminMetricMap> {
    return this.http.get<AdminMetricMap>(`${this.apiUrl}/dashboard`);
  }

  getBusinesses(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/businesses`);
  }

  updateBusiness(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/businesses/${id}`, data);
  }

  setBusinessActive(id: number, active: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/businesses/${id}/active`, { active });
  }

  getClients(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients`);
  }

  updateClient(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/clients/${id}`, data);
  }

  setClientActive(id: number, active: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/clients/${id}/active`, { active });
  }

  getReservations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reservations`);
  }

  getStats(): Observable<AdminMetricMap> {
    return this.http.get<AdminMetricMap>(`${this.apiUrl}/stats`);
  }

  getLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/logs`);
  }
}
