import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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
    return this.http.get<any>(`${this.apiUrl}/businesses`).pipe(
      map(response => response?.content || response?.items || response || [])
    );
  }

  searchBusinesses(params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/businesses`, { params });
  }

  getBusinessDetail(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/businesses/${id}`);
  }

  updateBusiness(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/businesses/${id}`, data);
  }

  setBusinessActive(id: number, active: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/businesses/${id}/status`, { active });
  }

  softDeleteBusiness(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/businesses/${id}`);
  }

  getClients(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients`);
  }

  searchClients(params: any): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/clients`, { params });
  }

  getClientDetail(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/clients/${id}`);
  }

  updateClient(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/clients/${id}`, data);
  }

  setClientActive(id: number, active: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/clients/${id}/status`, { active });
  }

  addClientPoints(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/clients/${id}/points/add`, data);
  }

  subtractClientPoints(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/clients/${id}/points/subtract`, data);
  }

  setClientPoints(id: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/clients/${id}/points/set`, data);
  }

  getClientPointsHistory(id: number, params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/clients/${id}/points/history`, { params });
  }

  getClientActivity(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/clients/${id}/activity`);
  }

  softDeleteClient(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/clients/${id}`);
  }

  getReservations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reservations`);
  }

  searchReservations(params: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reservations`, { params });
  }

  createReservation(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reservations`, data);
  }

  updateReservation(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/reservations/${id}`, data);
  }

  setReservationStatus(id: number, status: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/reservations/${id}/status`, { status });
  }

  softDeleteReservation(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/reservations/${id}`);
  }

  getStats(): Observable<AdminMetricMap> {
    return this.http.get<AdminMetricMap>(`${this.apiUrl}/stats`);
  }

  getLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/logs`);
  }
}
