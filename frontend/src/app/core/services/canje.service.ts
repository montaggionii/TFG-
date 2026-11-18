import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CanjePendiente {
  id: number;
  titulo: string;
  puntosGastados: number;
  codigo: string;        // CANJE:<id>:<token> — lo que codifica el QR
  expiraEn: number;      // segundos
  estado: string;
}

/**
 * Canje con QR temporal de un solo uso: el cliente genera el QR, el
 * restaurante lo valida en caja y si nadie lo valida a tiempo el cliente
 * cancela y recupera los puntos.
 */
@Injectable({ providedIn: 'root' })
export class CanjeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/canjes`;

  canjear(promocionId: number): Observable<CanjePendiente> {
    return this.http.post<CanjePendiente>(this.apiUrl, { promocionId });
  }

  estado(canjeId: number): Observable<CanjePendiente> {
    return this.http.get<CanjePendiente>(`${this.apiUrl}/${canjeId}`);
  }

  cancelar(canjeId: number): Observable<{ puntosDevueltos: number }> {
    return this.http.post<{ puntosDevueltos: number }>(`${this.apiUrl}/${canjeId}/cancelar`, {});
  }

  /** Llamada del restaurante tras escanear el QR del cliente. */
  validar(codigo: string): Observable<any> {
    const canjeId = Number(codigo.split(':')[1]);
    return this.http.post(`${this.apiUrl}/${canjeId}/validar`, { codigo });
  }
}
