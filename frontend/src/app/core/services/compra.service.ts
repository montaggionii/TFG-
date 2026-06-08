import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CompraService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/compras`;

  registrarCompra(data: { usuarioId: number, importe: number }): Observable<string> {
    return this.http.post(`${this.apiUrl}`, data, { responseType: 'text' });
  }
}
