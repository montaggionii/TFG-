import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Restaurantes favoritos del cliente: aparecen con estrella en la ficha
 * y primero en el mapa.
 */
@Injectable({ providedIn: 'root' })
export class FavoritoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/favoritos`;

  mios(): Observable<{ restaurantes: number[] }> {
    return this.http.get<{ restaurantes: number[] }>(this.apiUrl);
  }

  alternar(restauranteId: number): Observable<{ favorito: boolean }> {
    return this.http.post<{ favorito: boolean }>(`${this.apiUrl}/${restauranteId}`, {});
  }
}
