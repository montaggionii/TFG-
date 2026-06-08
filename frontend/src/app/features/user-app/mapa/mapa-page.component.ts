import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { MapComponent } from '../../../shared/components/map/map.component';
import { MapsService } from '../../../core/services/maps.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
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
export class MapaPageComponent implements OnInit {
  private mapsService = inject(MapsService);
  private router = inject(Router);
  private restauranteService = inject(RestauranteService);
  private toastCtrl = inject(ToastController);
  private apiUrl = environment.apiUrl;

  map: any;
  userLocation: { lat: number, lng: number } | null = null;
  
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

  constructor() {
    addIcons({ 
      locationOutline, restaurantOutline, star, cafeOutline, 
      beerOutline, closeOutline, informationCircleOutline, 
      giftOutline, chevronForwardOutline, chevronBackOutline,
      optionsOutline, searchOutline, location, navigateOutline,
      closeCircleOutline
    });
  }

  async ngOnInit() {
    await this.obtenerUbicacion();
  }

  async obtenerUbicacion() {
    try {
      this.userLocation = await this.mapsService.getCurrentLocation();
      this.cargarRestaurantes();
    } catch (error) {
      console.error('Error obteniendo ubicación', error);
      this.userLocation = { lat: 39.4699, lng: -0.3763 };
      this.cargarRestaurantes();
    }
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

        const toast = await this.toastCtrl.create({
          message: `Radar activo: ${this.restaurantesOriginales.length} locales en zona`,
          duration: 1500,
          position: 'top',
          color: 'primary'
        });
        toast.present();
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
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(value: number) {
    return value * Math.PI / 180;
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
