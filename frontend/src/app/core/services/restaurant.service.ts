import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private http = inject(HttpClient);
  // Nota: Siguiendo el snippet del usuario, usamos /recompensas, 
  // pero ajustamos a /api/recompensas si el backend sigue ese patrón.
  private get apiUrl(): string {
    const base = environment.apiUrl?.replace(/\/$/, '') || 'http://localhost:8081';
    return `${base}/api/recompensas`;
  }

  getPromociones(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearPromocion(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  actualizarPromocion(id: number | string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  eliminarPromocion(id: number | string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
