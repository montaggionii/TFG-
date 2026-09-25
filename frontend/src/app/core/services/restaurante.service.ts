import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RestauranteService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/restaurantes`;
  readonly restaurantPlaceholder = 'assets/img/rest-placeholder.png';
  private readonly localRestaurantImages = [
    'assets/img/restaurants/restaurant-roast.jpg',
    'assets/img/restaurants/restaurant-venezuelan.jpg',
    'assets/img/restaurants/restaurant-colombian.webp',
    'assets/img/restaurants/restaurant-table.jpg'
  ];

  getRestauranteById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getDashboardStats(id: number): Observable<any> {
    const t = new Date().getTime();
    return this.http.get<any>(`${this.apiUrl}/${id}/stats?t=${t}`);
  }

  getAdvancedStats(id: number): Observable<any> {
    const t = new Date().getTime();
    return this.http.get<any>(`${this.apiUrl}/${id}/stats-avanzadas?t=${t}`);
  }

  getEstadisticasPeriodo(id: number, periodo: 'SEMANA' | 'MES' | 'ANIO', comparar: boolean = true): Observable<any> {
    const t = new Date().getTime();
    return this.http.get<any>(`${this.apiUrl}/${id}/estadisticas?periodo=${periodo}&comparar=${comparar}&t=${t}`);
  }

  getRestaurantesCercanos(lat: number, lng: number, radio?: number): Observable<any[]> {
    const radioParam = radio ? `&radio=${radio}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/cercanos?lat=${lat}&lng=${lng}${radioParam}`);
  }

  updateRestaurante(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }
  subirImagen(id: number, formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/imagen`, formData);
  }

  resolveRestaurantImage(source: any): string {
    const raw = this.getRestaurantImageCandidate(source);
    if (raw) return this.resolverImagenUrl(raw);
    if (source && typeof source === 'object') return this.getLocalRestaurantImage(source);
    return this.restaurantPlaceholder;
  }

  resolverImagenUrl(url: string | null | undefined): string {
    const raw = String(url ?? '').trim();
    if (!raw || raw === 'null' || raw === 'undefined') return this.restaurantPlaceholder;
    
    if (raw.startsWith('data:')) return raw;

    if (raw.startsWith('assets/')) return raw;
    if (raw.startsWith('/assets/')) return raw.substring(1);

    // Reparar IP si contiene /uploads/
    const uploadsIdx = raw.indexOf('/uploads/');
    if (uploadsIdx >= 0) {
      const relativePath = raw.substring(uploadsIdx);
      return `${environment.apiUrl}${relativePath}`;
    }

    if (raw.startsWith('http')) return raw;
    
    const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
    if (!cleanPath.startsWith('/uploads/')) {
       return `${environment.apiUrl}/uploads${cleanPath}`;
    }

    return `${environment.apiUrl}${cleanPath}`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.restaurantPlaceholder)) return;
    img.src = this.restaurantPlaceholder;
    img.classList.add('ff-image-fallback');
  }

  getLocalRestaurantImage(source: any): string {
    const key = String(
      source?.id ??
      source?.restauranteId ??
      source?.restaurantId ??
      source?.nombre ??
      source?.restaurantName ??
      ''
    );

    if (!key.trim()) return this.restaurantPlaceholder;

    const hash = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.localRestaurantImages[hash % this.localRestaurantImages.length];
  }

  resolvePromotionImage(promotion: any, restaurantFallback?: any): string {
    const raw = this.getRestaurantImageCandidate(promotion);
    if (raw) return this.resolverImagenUrl(raw);

    const restaurantSource = promotion?.restaurante || restaurantFallback || {
      id: promotion?.restauranteId || promotion?.idRestaurante || promotion?.restaurantId,
      nombre: promotion?.nombreRestaurante || promotion?.restaurantName
    };

    return this.resolveRestaurantImage(restaurantSource);
  }

  private getRestaurantImageCandidate(source: any): string | null {
    if (!source) return null;
    if (typeof source === 'string') return source;

    const fields = [
      'imagenUrl',
      'imageUrl',
      'fotoUrl',
      'logoUrl',
      'imagenPerfil',
      'restaurantImage',
      'restaurantImageUrl',
      'imagenPrincipal',
      'imagen',
      'foto',
      'fotoPerfil',
      'logo'
    ];

    for (const field of fields) {
      const value = source?.[field];
      if (typeof value === 'string' && value.trim()) return value;
    }

    return null;
  }
}
