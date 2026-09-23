import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Geolocation, Position } from '@capacitor/geolocation';

export type GeoStatus =
  | 'idle'          // todavía no se ha pedido nada
  | 'requesting'    // esperando la respuesta del permiso/primera posición
  | 'active'        // hay una posición válida y el watch sigue activo
  | 'denied'        // el usuario denegó el permiso
  | 'unavailable'   // el dispositivo/navegador no tiene geolocalización
  | 'timeout'       // no se obtuvo posición a tiempo
  | 'error';        // cualquier otro error

export interface GeoCoords {
  lat: number;
  lng: number;
}

// Un nuevo punto solo se emite (y por tanto solo se recalculan distancias/
// radio en toda la app) si el usuario se ha movido al menos esto — evita
// recalcular en cada micro-lectura del GPS sin necesidad.
const MIN_DISPLACEMENT_METERS = 25;

/**
 * Fuente única de verdad para la ubicación del usuario en toda la app.
 *
 * Usa @capacitor/geolocation (ya era una dependencia del proyecto, sin
 * usar) en vez de navigator.geolocation directamente: en web delega en la
 * misma Geolocation API del navegador, y en una build nativa de Capacitor
 * usa el proveedor nativo — un único camino de código para ambas
 * plataformas, sin implementaciones redundantes.
 *
 * Los componentes NO deben leer navigator.geolocation ni el plugin
 * directamente — deben inyectar este servicio y suscribirse a location$/status$.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly statusSubject = new BehaviorSubject<GeoStatus>('idle');
  private readonly locationSubject = new BehaviorSubject<GeoCoords | null>(null);

  readonly status$: Observable<GeoStatus> = this.statusSubject.asObservable();
  readonly location$: Observable<GeoCoords | null> = this.locationSubject.asObservable();

  private watchId: string | null = null;
  private activeSubscribers = 0;
  private lastEmitted: GeoCoords | null = null;

  constructor(private zone: NgZone) {}

  get status(): GeoStatus {
    return this.statusSubject.value;
  }

  get currentLocation(): GeoCoords | null {
    return this.locationSubject.value;
  }

  /**
   * Empieza a observar la posición si todavía no había nadie observando.
   * Varias páginas pueden llamar a esto a la vez (recuento de referencias):
   * el watch nativo/del navegador solo se crea una vez y solo se destruye
   * cuando la última página que lo pidió llama a stopWatching().
   */
  async startWatching(): Promise<void> {
    this.activeSubscribers++;
    if (this.watchId !== null || this.statusSubject.value === 'requesting') {
      return;
    }

    this.statusSubject.next('requesting');

    const hasPermission = await this.ensurePermission();
    if (!hasPermission) {
      return; // ensurePermission ya dejó el status en 'denied'/'unavailable'
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        },
        (position, err) => this.zone.run(() => this.handleUpdate(position, err))
      );
    } catch (err) {
      this.zone.run(() => this.handleError(err));
    }
  }

  /**
   * Deja de observar la posición cuando ya ninguna página la necesita.
   * Debe llamarse siempre desde ngOnDestroy de quien llamó a startWatching().
   */
  async stopWatching(): Promise<void> {
    this.activeSubscribers = Math.max(0, this.activeSubscribers - 1);
    if (this.activeSubscribers > 0) return;

    if (this.watchId !== null) {
      try {
        await Geolocation.clearWatch({ id: this.watchId });
      } catch {
        // el watch ya no existía (p.ej. permiso revocado entretanto) — ignorable
      }
      this.watchId = null;
    }
  }

  /**
   * Posición puntual (sin dejar un watch activo). Útil para una acción
   * concreta que solo necesita la posición una vez.
   */
  async getCurrentLocation(): Promise<GeoCoords> {
    const hasPermission = await this.ensurePermission();
    if (!hasPermission) {
      throw new Error(`Geolocalización no disponible: ${this.statusSubject.value}`);
    }

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000
      });
      const coords: GeoCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
      this.lastEmitted = coords;
      this.locationSubject.next(coords);
      this.statusSubject.next('active');
      return coords;
    } catch (err) {
      this.handleError(err);
      throw err;
    }
  }

  /** Vuelve a pedir permiso tras una denegación (botón "Reintentar"). */
  async retry(): Promise<void> {
    this.statusSubject.next('idle');
    if (this.activeSubscribers > 0) {
      await this.startWatching();
    }
  }

  private async ensurePermission(): Promise<boolean> {
    if (!('geolocation' in navigator) && typeof (Geolocation as any).checkPermissions !== 'function') {
      this.statusSubject.next('unavailable');
      return false;
    }

    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        perm = await Geolocation.requestPermissions();
      }
      if (perm.location === 'denied') {
        this.statusSubject.next('denied');
        return false;
      }
      return true;
    } catch (err) {
      // Algunos navegadores de escritorio no implementan checkPermissions/
      // requestPermissions del plugin — el propio watchPosition/getCurrentPosition
      // ya dispara el prompt nativo del navegador, así que seguimos adelante.
      return true;
    }
  }

  private handleUpdate(position: Position | null, err: any): void {
    if (err) {
      this.handleError(err);
      return;
    }
    if (!position) return;

    const coords: GeoCoords = { lat: position.coords.latitude, lng: position.coords.longitude };

    if (this.lastEmitted && this.distanceMeters(this.lastEmitted, coords) < MIN_DISPLACEMENT_METERS) {
      return; // movimiento insignificante — no recalcules toda la app por ruido del GPS
    }

    this.lastEmitted = coords;
    this.locationSubject.next(coords);
    this.statusSubject.next('active');
  }

  private handleError(err: any): void {
    const code = err?.code;
    // Códigos del estándar PositionError (1=denied, 2=unavailable, 3=timeout)
    if (code === 1) this.statusSubject.next('denied');
    else if (code === 3) this.statusSubject.next('timeout');
    else if (code === 2) this.statusSubject.next('unavailable');
    else this.statusSubject.next('error');
  }

  /** Distancia entre dos puntos (fórmula de Haversine) en kilómetros. */
  distanceKm(a: GeoCoords, b: GeoCoords): number {
    const R = 6371;
    const dLat = this.toRad(b.lat - a.lat);
    const dLng = this.toRad(b.lng - a.lng);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat +
      Math.cos(this.toRad(a.lat)) * Math.cos(this.toRad(b.lat)) * sinLng * sinLng;
    return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }

  private distanceMeters(a: GeoCoords, b: GeoCoords): number {
    return this.distanceKm(a, b) * 1000;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /** "850 m" por debajo de 1 km, "1,2 km" a partir de ahí. */
  static formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1).replace('.', ',')} km`;
  }
}
