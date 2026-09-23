import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MapComponent } from '../../../shared/components/map/map.component';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GeolocationService, GeoStatus } from '../../../core/services/geolocation.service';
import { addIcons } from 'ionicons';
import { 
  locationOutline, restaurantOutline, star, cafeOutline, 
  beerOutline, closeOutline, informationCircleOutline, 
  giftOutline, chevronForwardOutline, chevronBackOutline,
  optionsOutline, searchOutline, location, navigateOutline,
  closeCircleOutline
} from 'ionicons/icons';
import { environment } from '../../../../environments/environment';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa-page.component.html',
  styleUrls: ['./mapa-page.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, MapComponent, FormsModule, RouterModule, CustomerTranslatePipe, SafeRestaurantImageDirective]
})
export class MapaPageComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private restauranteService = inject(RestauranteService);
  private toastCtrl = inject(ToastController);
  private geoService = inject(GeolocationService);
  private apiUrl = environment.apiUrl;

  map: any;
  userLocation: { lat: number, lng: number } | null = null;
  geoStatus: GeoStatus = 'idle';
  showActiveBadge = false;
  private activeBadgeTimer: ReturnType<typeof setTimeout> | undefined;
  private geoSub?: Subscription;
  private statusSub?: Subscription;

  // Datos
  restaurantesOriginales: any[] = [];
  restaurantesFiltrados: any[] = [];
  mapMarkers: any[] = [];
  
  // Filtros
  radioKm: number = 10;
  searchQuery = '';
  isLoading = false;

  // UI
  selectedRestaurant: any = null;
  showDetailSheet = false;
  showFilterPanel = false;
  private hasShownRadarToast = false;

  constructor() {
    addIcons({ 
      locationOutline, restaurantOutline, star, cafeOutline, 
      beerOutline, closeOutline, informationCircleOutline, 
      giftOutline, chevronForwardOutline, chevronBackOutline,
      optionsOutline, searchOutline, location, navigateOutline,
      closeCircleOutline
    });
  }

  ngOnInit() {
    this.statusSub = this.geoService.status$.subscribe(status => {
      const becameActive = status === 'active' && this.geoStatus !== 'active';
      this.geoStatus = status;

      if (becameActive) {
        // Confirmación breve, no un badge permanente en pantalla.
        this.showActiveBadge = true;
        clearTimeout(this.activeBadgeTimer);
        this.activeBadgeTimer = setTimeout(() => (this.showActiveBadge = false), 2500);
      }
    });

    this.geoSub = this.geoService.location$.subscribe(coords => {
      if (!coords) return;
      const isFirstFix = !this.userLocation;
      this.userLocation = coords;
      this.cargarRestaurantes();
      if (!isFirstFix) {
        // El usuario se ha desplazado lo suficiente como para recalcular —
        // no interrumpimos con un toast por cada corrección de posición.
        this.actualizarMarcadores();
      }
    });

    this.geoService.startWatching();
  }

  ngOnDestroy() {
    this.geoSub?.unsubscribe();
    this.statusSub?.unsubscribe();
    clearTimeout(this.activeBadgeTimer);
    this.geoService.stopWatching();
  }

  reintentarUbicacion() {
    this.geoService.retry();
  }

  cargarRestaurantes() {
    if (!this.userLocation) return;
    
    this.isLoading = true;

    this.restauranteService.getRestaurantesCercanos(this.userLocation.lat, this.userLocation.lng, this.radioKm).subscribe({
      next: async (data: any[]) => {
        console.log("📦 [DEBUG] Locales recibidos del backend:", data.length);
        
        this.restaurantesOriginales = data.map((r: any) => ({
          ...r,
          lat: r.latitud || r.lat,
          lng: r.longitud || r.lng,
          rating: r.rating || '4.5',
          distanciaNum: this.calcularDistancia(this.userLocation!.lat, this.userLocation!.lng, r.latitud || r.lat, r.longitud || r.lng),
          tipo: r.tipo || 'Gourmet',
          promociones: r.promociones || [],
          imagenUrl: this.restauranteService.resolveRestaurantImage(r)
        }));
        
        this.filtrarPorDistancia();
        this.isLoading = false;

        // Solo la primera vez: con el watch activo, cargarRestaurantes() se
        // repite en cada actualización real de posición, y no queremos un
        // toast por cada una.
        if (!this.hasShownRadarToast) {
          this.hasShownRadarToast = true;
          const toast = await this.toastCtrl.create({
            message: `Radar activo: ${this.restaurantesOriginales.length} locales en zona`,
            duration: 1500,
            position: 'top',
            color: 'primary'
          });
          toast.present();
        }
      },
      error: (err: any) => {
        console.error('Error cargando restaurantes:', err);
        this.restaurantesOriginales = [];
        this.filtrarPorDistancia();
        this.isLoading = false;
      }
    });
  }

  filtrarPorDistancia() {
    if (!this.userLocation) return;

    const query = this.normalizeSearchText(this.searchQuery);
    const filtrados = this.restaurantesOriginales.filter(r => {
      const isInsideRadius = r.distanciaNum <= this.radioKm;
      const matchesSearch = !query || this.restaurantMatchesSearch(r, query);
      return isInsideRadius && matchesSearch;
    });

    this.restaurantesFiltrados = filtrados;

    this.actualizarMarcadores();
  }

  onSearchChange() {
    this.filtrarPorDistancia();
  }

  clearSearch() {
    this.searchQuery = '';
    this.filtrarPorDistancia();
  }

  private restaurantMatchesSearch(restaurante: any, query: string): boolean {
    const searchableFields = [
      restaurante.nombre,
      restaurante.tipo,
      restaurante.categoria,
      restaurante.direccion,
      restaurante.ciudad,
      restaurante.descripcion
    ];

    const haystack = this.normalizeSearchText(searchableFields.join(' '));
    const aliases = this.getCuisineSearchAliases(haystack);

    return `${haystack} ${aliases}`.includes(query);
  }

  private getCuisineSearchAliases(haystack: string): string {
    const aliases: string[] = [];

    if (haystack.includes('venezuela') || haystack.includes('venezol')) {
      aliases.push('venezolana venezolano venezuelan');
    }

    if (haystack.includes('mexic')) {
      aliases.push('mexicano mexicana mexican');
    }

    if (haystack.includes('colomb')) {
      aliases.push('colombiana colombiano colombian');
    }

    if (haystack.includes('cafe') || haystack.includes('cafeteria')) {
      aliases.push('cafe cafeteria coffee');
    }

    return aliases.join(' ');
  }

  private normalizeSearchText(value: unknown): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  actualizarMarcadores() {
    if (!this.userLocation) return;

    const restaurantMarkers = this.restaurantesFiltrados.map(rest => ({
      lat: rest.lat,
      lng: rest.lng,
      nombre: rest.nombre,
      type: 'restaurant',
      data: rest
    }));

    this.mapMarkers = [
      {
        lat: this.userLocation.lat,
        lng: this.userLocation.lng,
        type: 'user'
      },
      ...restaurantMarkers
    ];
  }

  calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return this.geoService.distanceKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  }

  formatDistancia(km: number): string {
    return GeolocationService.formatDistance(km);
  }

  handleMarkerClick(rest: any) {
    this.selectedRestaurant = rest;
    this.showDetailSheet = true;
    if (this.map) {
      this.map.panTo({ lat: rest.lat, lng: rest.lng });
      this.map.setZoom(16);
    }
  }

  toggleFilter() {
    this.showFilterPanel = !this.showFilterPanel;
  }

  onMapReady(map: any) {
    this.map = map;
  }

  closeDetailSheet() {
    this.showDetailSheet = false;
    setTimeout(() => this.selectedRestaurant = null, 300);
  }

  irADetalle(restaurante?: any) {
    const target = restaurante || this.selectedRestaurant;
    if (target) {
      this.router.navigate(['/u/restaurante', target.id], {
        queryParams: { 
          distancia: target.distanciaNum?.toFixed(1) || '0.0'
        }
      });
    }
  }

  abrirGoogleMaps(event: Event) {
    event.stopPropagation();
    if (!this.selectedRestaurant) return;
    const lat = this.selectedRestaurant.lat;
    const lng = this.selectedRestaurant.lng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  }

  verPromociones(event: Event) {
    event.stopPropagation();
    if (this.selectedRestaurant) {
      this.router.navigate(['/u/restaurante', this.selectedRestaurant.id], {
        queryParams: { 
          distancia: this.selectedRestaurant.distanciaNum?.toFixed(1) || '0.0',
          tab: 'promos'
        }
      });
    }
  }

  getIconForTipo(tipo: string): string {
    switch (tipo?.toLowerCase()) {
      case 'bar': return 'beer-outline';
      case 'cafetería': return 'cafe-outline';
      default: return 'restaurant-outline';
    }
  }

  goBack() {
    this.router.navigate(['/u/home']);
  }

  resolverImagen(path: string | null): string {
    return this.restauranteService.resolverImagenUrl(path);
  }
}
