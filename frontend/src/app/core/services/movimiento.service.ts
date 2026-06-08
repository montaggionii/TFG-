import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/movimientos`;

  getHistorial(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`);
  }

  crearMovimiento(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, data);
  }
}
