import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PromocionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/promociones`;

  // El backend devuelve `puntosOtorgados` (campo real de la entidad
  // Promocion), pero varias pantallas de cliente leen `puntosNecesarios`
  // para el mismo dato (mismo mismatch ya resuelto a mano en
  // mis-promociones.component.ts) -> se añade aquí una vez, para todo el
  // que consuma este servicio.
  private conPuntosNecesarios(promos: any[]): any[] {
    return promos.map(p => ({ ...p, puntosNecesarios: p.puntosNecesarios ?? p.puntosOtorgados }));
  }

  getPromociones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}`).pipe(map(promos => this.conPuntosNecesarios(promos)));
  }

  getPromocionesByRestaurante(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/restaurante/${id}`).pipe(map(promos => this.conPuntosNecesarios(promos)));
  }

  crearPromocion(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, data);
  }

  aplicarPromocion(id: number, usuarioId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/aplicar`, { usuarioId });
  }

  canjearPromocion(usuarioId: number, promocionId: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/api/canjes`, { usuarioId, promocionId });
  }
  updatePromocion(id: number, data: any): Observable<any> {
    if (data instanceof FormData) {
      // Usamos el nuevo endpoint de actualización para Multipart
      return this.http.post<any>(`${this.apiUrl}/${id}`, data);
    }
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deletePromocion(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
