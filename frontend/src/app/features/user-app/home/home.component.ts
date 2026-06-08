import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, ModalController } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { UsuarioService } from '../../../core/services/usuario.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { MapsService } from '../../../core/services/maps.service';
import { PuntosService } from '../../../core/services/puntos.service';
import { GlobalStateService, UserState } from '../../../core/state/global-state.service';
import { UserCardComponent } from '../../../shared/components/user-card/user-card.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { AppCardComponent } from '../../../shared/components/app-card/app-card.component';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';
import { PromocionService } from '../../../core/services/promocion.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

interface HomeNewsBanner {
  id: string | number;
  eyebrowKey?: string;
  title?: string;
  titleKey?: string;
  subtitle?: string;
  subtitleKey?: string;
  subtitleParams?: Record<string, string | number>;
  actionKey: string;
  bgClass: string;
  icon: string;
  route: any[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [
    IonicModule, 
    CommonModule, 
    UserCardComponent, 
    SectionHeaderComponent, 
    AppCardComponent,
    RouterLink,
    CustomerTranslatePipe,
    SafeRestaurantImageDirective
  ]
})
export class HomeComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private restauranteService = inject(RestauranteService);
  private mapsService = inject(MapsService);
  private puntosService = inject(PuntosService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private promocionService = inject(PromocionService);

  public icons = allIcons;

  constructor() {
    addIcons({
      homeOutline: allIcons.homeOutline,
      giftOutline: allIcons.giftOutline,
      statsChartOutline: allIcons.statsChartOutline,
      locationOutline: allIcons.locationOutline,
      pricetagOutline: allIcons.pricetagOutline,
      trophy: allIcons.trophy,
      medal: allIcons.medal,
      ribbon: allIcons.ribbon,
      expandOutline: allIcons.expandOutline,
      restaurantOutline: allIcons.restaurantOutline,
      walletOutline: allIcons.walletOutline,
      star: allIcons.star,
      barcodeOutline: allIcons.barcodeOutline,
      cartOutline: allIcons.cartOutline,
      timeOutline: allIcons.timeOutline,
      mapOutline: allIcons.mapOutline,
      closeOutline: allIcons.closeOutline,
      arrowForwardOutline: allIcons.arrowForwardOutline,
      iceCreamOutline: allIcons.iceCreamOutline,
      beerOutline: allIcons.beerOutline,
      bulbOutline: allIcons.bulbOutline,
      flameOutline: allIcons.flameOutline,
      navigateCircleOutline: allIcons.navigateCircleOutline
    });
  }

  user: UserState | null = null;
  isLoading = true;
  error = false;
  today = new Date();

  // Mapa y Restaurantes
  userLocation: { lat: number, lng: number } | null = null;
  mapMarkers: any[] = [];
  nearbyRestaurants: any[] = [];
  
  featuredRewards: any[] = [];

  promotionalBanners: HomeNewsBanner[] = [this.createInstitutionalBanner()];

  private lastProcessedId: number | null = null;

  async ngOnInit() {
    // Sincronización reactiva con el estado global (Senior Engineering)
    this.globalState.userState$.subscribe(state => {
      if (state && state.id) {
        // Solo recargar si es un ID distinto al último procesado (evita bucles infinitos)
        if (state.id !== this.lastProcessedId) {
          this.lastProcessedId = state.id;
          this.user = state;
          this.cargarDatosUsuario(false);
          this.inicializarMapa();
        } else {
          // Si es el mismo ID, solo actualizamos la referencia local sin re-disparar carga pesada
          this.user = state;
        }
      } else {
        this.user = null;
        this.lastProcessedId = null;
      }
    });
  }

  async inicializarMapa() {
    try {
      this.userLocation = await this.mapsService.getCurrentLocation();
      this.cargarLocalesValencia();
      this.cargarPromocionesReales();
    } catch (err) {
      // Fallback Valencia Centro si falla la geolocalización
      this.userLocation = { lat: 39.4699, lng: -0.3763 };
      this.cargarLocalesValencia();
      this.cargarPromocionesReales();
    }
  }

  cargarPromocionesReales() {
    this.promocionService.getPromociones().subscribe({
      next: (promos) => {
        if (!promos || !Array.isArray(promos)) {
          this.featuredRewards = [];
          return;
        }

        // 1. Filtrar solo las recompensas (CANJEAR) para el catálogo de destacados
        const canjes = promos.filter(p => p.tipo === 'CANJEAR');

        // 2. Tomar un máximo de 4 para no saturar el Dashboard y asegurar que se vean increíbles
        this.featuredRewards = canjes.slice(0, 4).map(promo => {
          const rId = promo.restaurante?.id || promo.restauranteId || promo.idRestaurante;
          const restaurantFallback = promo.restaurante || {
            id: rId,
            nombre: promo.nombreRestaurante || promo.restaurantName
          };

          return {
            id: promo.id,
            title: promo.titulo,
            points: promo.puntosNecesarios || promo.puntos || 0,
            restaurantId: rId,
            restaurantName: promo.restaurante?.nombre || promo.nombreRestaurante || 'home.fallback.associatedRestaurant',
            imageUrl: this.restauranteService.resolvePromotionImage(promo, restaurantFallback),
            tipo: promo.tipo 
          };
        });
        this.updatePromotionalBanners();
        console.log("✅ Dashboard: Recompensas premium preparadas", this.featuredRewards);
      },
      error: (err) => {
        console.error("❌ Error al cargar promociones", err);
        this.featuredRewards = [];
        this.updatePromotionalBanners();
      }
    });
  }

  radioKm = 10; // Radio por defecto visto en UI

  cargarLocalesValencia() {
    // Eliminados locales Mock para usar exclusivamente la base de datos real
    const localesMock: any[] = [];

    // Combinar con locales reales del backend si existen, usando el radio de la UI
    this.restauranteService.getRestaurantesCercanos(this.userLocation!.lat, this.userLocation!.lng, this.radioKm).subscribe({
      next: (backendRestaurantes) => {
        // Filtrar mocks para no duplicar si ya vienen del backend (por nombre)
        const filteredMocks = localesMock.filter(m => 
          !backendRestaurantes.some(br => br.nombre.toLowerCase() === m.nombre.toLowerCase())
        );

        const allRest = [...filteredMocks, ...backendRestaurantes];
        
        this.nearbyRestaurants = allRest.map(r => {
          const dist = this.calculateDistance(
            this.userLocation!.lat, this.userLocation!.lng,
            r.latitud, r.longitud
          );
          return {
            ...r,
            distance: dist,
            distanceText: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`,
            ptsPerEuro: 10
          };
        }).sort((a, b) => a.distance - b.distance);

        this.updatePromotionalBanners();
        this.generateMarkers();
      },
      error: () => {
        // Si el backend falla, usamos los mocks mejorados
        this.nearbyRestaurants = localesMock.map(r => {
          const dist = this.calculateDistance(
            this.userLocation!.lat, this.userLocation!.lng,
            r.latitud, r.longitud
          );
          return {
            ...r,
            distance: dist,
            distanceText: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`,
            ptsPerEuro: 10
          };
        }).sort((a, b) => a.distance - b.distance);
        
        this.updatePromotionalBanners();
        this.generateMarkers();
      }
    });
  }

  private updatePromotionalBanners(): void {
    const closestRestaurant = this.nearbyRestaurants[0];

    if (closestRestaurant) {
      const restaurantId = closestRestaurant.id || closestRestaurant.restauranteId;
      this.promotionalBanners = [{
        id: `nearby-${restaurantId || closestRestaurant.nombre}`,
        eyebrowKey: 'home.banner.nearby.eyebrow',
        title: closestRestaurant.nombre,
        subtitleKey: 'home.banner.nearby.subtitle',
        subtitleParams: { distance: closestRestaurant.distanceText },
        actionKey: 'home.card.viewRestaurant',
        bgClass: 'banner-bg-primary',
        icon: 'restaurant-outline',
        route: restaurantId ? ['/u/restaurante', restaurantId] : ['/u/mapa']
      }];
      return;
    }

    const realReward = this.featuredRewards[0];

    if (realReward) {
      const rewardRestaurantName = typeof realReward.restaurantName === 'string' && !realReward.restaurantName.startsWith('home.')
        ? realReward.restaurantName
        : null;

      this.promotionalBanners = [{
        id: `reward-${realReward.id}`,
        eyebrowKey: 'home.banner.reward.eyebrow',
        title: realReward.title,
        subtitleKey: rewardRestaurantName ? 'home.banner.reward.subtitle' : 'home.banner.reward.subtitleGeneric',
        subtitleParams: rewardRestaurantName ? { restaurant: rewardRestaurantName } : undefined,
        actionKey: 'home.card.viewRestaurant',
        bgClass: 'banner-bg-dark',
        icon: 'gift-outline',
        route: realReward.restaurantId ? ['/u/restaurante', realReward.restaurantId] : ['/u/recompensas']
      }];
      return;
    }

    this.promotionalBanners = [this.createInstitutionalBanner()];
  }

  private createInstitutionalBanner(): HomeNewsBanner {
    return {
      id: 'fidelyfood-tip',
      eyebrowKey: 'home.banner.tip.eyebrow',
      titleKey: 'home.banner.tip.title',
      subtitleKey: 'home.banner.tip.subtitle',
      actionKey: 'home.sections.nearby.action',
      bgClass: 'banner-bg-dark',
      icon: 'bulb-outline',
      route: ['/u/mapa']
    };
  }

  generateMarkers() {
    const restaurantMarkers = this.nearbyRestaurants.map(r => ({
      lat: r.latitud,
      lng: r.longitud,
      nombre: r.nombre,
      type: 'restaurant',
      data: r
    }));

    this.mapMarkers = [
      {
        lat: this.userLocation!.lat,
        lng: this.userLocation!.lng,
        type: 'user'
      },
      ...restaurantMarkers
    ];
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }



  cargarDatosUsuario(isRefresh: boolean, event?: any) {
    if (!isRefresh) this.isLoading = true;
    if (!this.user?.id) {
      this.isLoading = false;
      return;
    }

    const userId: number = this.user.id; // capturado antes del callback async

    this.usuarioService.getUsuarioById(userId).subscribe({
      next: (data) => {
        // Cargar el total global real desde la tabla por restaurante
        this.puntosService.getTotalPuntos(userId).subscribe({
          next: (res) => {
            const updatedState: UserState = {
              ...this.user!,
              nombre: data.nombre,
              puntos: res.puntos, // ✅ Suma real de todos los restaurantes
              qrCode: data.qrCode,
              fotoPerfil: this.usuarioService.resolveImageUrl(data.fotoPerfil) || undefined
            };

            this.user = updatedState;
            this.globalState.setState(updatedState);
            this.isLoading = false;
            if (event) event.target.complete();
          },
          error: () => {
            // Fallback: usar puntos del DTO de usuario si falla el endpoint de total
            const updatedState: UserState = {
              ...this.user!,
              nombre: data.nombre,
              puntos: data.puntos,
              qrCode: data.qrCode,
              fotoPerfil: this.usuarioService.resolveImageUrl(data.fotoPerfil) || undefined
            };

            this.user = updatedState;
            this.globalState.setState(updatedState);
            this.isLoading = false;
            if (event) event.target.complete();
          }
        });
      },
      error: () => {
        this.error = true;
        this.isLoading = false;
        if (event) event.target.complete();
      }
    });
  }

  refrescar(event: any) {
    this.cargarDatosUsuario(true, event);
    this.inicializarMapa();
  }

  getRestaurantInitials(name: string | undefined | null): string {
    if (!name) return 'FF';

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  getNearbyTagKey(index: number): string {
    return index === 0 ? 'home.nearby.tag.closest' : 'home.nearby.tag.near';
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }
}
