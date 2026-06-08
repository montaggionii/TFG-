import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';


export interface UsuarioPuntos {
  id: number;
  nombre: string;
  email: string;
  puntos: number;
  fotoPerfil?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PuntosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api`;

  // Obtener datos del cliente escaneado
  getUsuarioPorId(userId: string | number): Observable<UsuarioPuntos> {
    return this.http.get<UsuarioPuntos>(`${this.apiUrl}/usuarios/${userId}`);
  }

  identificarUsuarioPorQr(qr: string): Observable<UsuarioPuntos> {
    return this.http.post<UsuarioPuntos>(`${this.apiUrl}/usuarios/identificar-qr`, { qr });
  }

  // Obtener puntos de un usuario en un restaurante específico (para detalle de restaurante)
  getPuntosPorRestaurante(usuarioId: number, restauranteId: number): Observable<{puntos: number}> {
    return this.http.get<{puntos: number}>(`${this.apiUrl}/puntos/${usuarioId}/${restauranteId}`);
  }



  // Obtener total global de puntos (suma de todos los restaurantes, para el dashboard)
  getTotalPuntos(usuarioId: number): Observable<{puntos: number}> {
    return this.http.get<{puntos: number}>(`${this.apiUrl}/puntos/${usuarioId}/total`);
  }

  // Sumar puntos al cliente
  sumarPuntos(payload: {
    usuarioId: number;
    restauranteId: number;
    monto: number;
    puntos: number;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/puntos`, payload);
  }
}
