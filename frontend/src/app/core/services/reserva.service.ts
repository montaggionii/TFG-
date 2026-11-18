import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Reserva {
  id: number;
  fecha: string;
  personas: number;
  estado: string;          // PENDING | CONFIRMED | CANCELLED
  notas?: string;
  cliente?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  restauranteNombre?: string;
  restauranteId?: number;
}

/**
 * Reservas de mesa: cliente reserva desde la ficha del restaurante,
 * restaurante confirma o rechaza desde su panel.
 */
@Injectable({ providedIn: 'root' })
export class ReservaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/reservas`;

  crear(datos: { restauranteId: number; fecha: string; personas: number; notas?: string }): Observable<Reserva> {
    return this.http.post<Reserva>(this.apiUrl, datos);
  }

  mias(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.apiUrl}/mias`);
  }

  cancelar(id: number): Observable<Reserva> {
    return this.http.post<Reserva>(`${this.apiUrl}/${id}/cancelar`, {});
  }

  delRestaurante(): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(`${this.apiUrl}/restaurante`);
  }

  cambiarEstado(id: number, estado: 'CONFIRMED' | 'CANCELLED'): Observable<Reserva> {
    return this.http.post<Reserva>(`${this.apiUrl}/${id}/estado`, { estado });
  }
}
