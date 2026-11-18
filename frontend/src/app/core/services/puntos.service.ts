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

  /** Nivel, racha semanal, puntos del mes, locales visitados… */
  getResumenFidelidad(usuarioId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/puntos/${usuarioId}/resumen`);
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


  /** Stream SSE del saldo: emite {puntos} cada vez que cambia (compra registrada, canje…). */
  streamPuntos(usuarioId: number, token: string, onDelta: (delta: number) => void, onError?: () => void): EventSource {
    const source = new EventSource(`${environment.apiUrl}/api/puntos/${usuarioId}/stream?token=${encodeURIComponent(token)}`);
    let previo: number | null = null;
    source.addEventListener('puntos', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const puntos = Number(data.puntos);
        if (previo !== null && puntos !== previo) onDelta(puntos - previo);
        previo = puntos;
      } catch { /* evento ilegible: ignorar */ }
    });
    source.onerror = () => { onError?.(); };
    return source;
  }

  sorpresaDelDia(): Observable<{premio: number; puntos: number}> {
    return this.http.post<{premio: number; puntos: number}>(`${this.apiUrl}/puntos/sorpresa`, {});
  }

  reclamarPasaporte(usuarioId: number): Observable<{premio: number; puntos: number}> {
    return this.http.post<{premio: number; puntos: number}>(`${this.apiUrl}/puntos/${usuarioId}/pasaporte/reclamar`, {});
  }

  getRecomendacion(usuarioId: number, lat: number, lng: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/puntos/${usuarioId}/recomendacion?lat=${lat}&lng=${lng}`);
  }
}
