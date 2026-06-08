import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  syncOutline, 
  cloudOfflineOutline, 
  statsChartOutline, 
  qrCodeOutline, 
  addCircleOutline, 
  removeCircleOutline, 
  star,
  cashOutline,
  peopleOutline,
  checkmarkOutline,
  timeOutline,
  giftOutline,
  scanOutline,
  pricetagOutline,
  settingsOutline,
  listOutline
} from 'ionicons/icons';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { RestaurantService } from '../../../core/services/restaurant.service';
import { GlobalStateService, UserState } from '../../../core/state/global-state.service';
import { MapComponent } from '../../../shared/components/map/map.component';
import { RouterModule } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { FormPromocionComponent } from '../mis-promociones/form-promocion/form-promocion.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, MapComponent, RouterModule]
})
export class DashboardComponent implements OnInit {
  private restauranteService = inject(RestauranteService);
  private restaurantService = inject(RestaurantService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  today: number = Date.now();

  constructor() {
    addIcons({ 
      syncOutline, 
      cloudOfflineOutline, 
      statsChartOutline, 
      qrCodeOutline, 
      addCircleOutline, 
      removeCircleOutline, 
      star,
      cashOutline,
      peopleOutline,
      checkmarkOutline,
      timeOutline,
      giftOutline,
      scanOutline,
      pricetagOutline,
      settingsOutline,
      listOutline
    });
  }

  business: UserState | null | undefined;
  extendedData: any;
  restauranteImageUrl: string = '';
  isLoading = true;
  error = false;

  promociones: any[] = [];
  activityStats: any;

  // Mapa
  location: { lat: number, lng: number } | null = null;
  markers: any[] = [];

  ngOnInit() {
    this.business = this.globalState.getState();
    this.cargarDatos();
  }

  /**
   * Refresco automático al entrar en la pestaña (Ionic Lifecycle)
   */
  ionViewWillEnter() {
    console.log('🔄 [DASHBOARD] Re-sincronizando datos al entrar...');
    this.business = this.globalState.getState();
    this.cargarDatos();
  }

  cargarDatos(event?: any) {
    if (!event) this.isLoading = true;
    this.error = false;
    
    if (!this.business?.id) {
       if (!event) this.isLoading = false;
       if (event) event.target.complete();
       return;
    }

    // 1. Datos del restaurante (Petición principal)
    this.restauranteService.getRestauranteById(this.business.id).subscribe({
      next: (data) => {
        this.extendedData = data;
        this.restauranteImageUrl = this.restauranteService.resolveRestaurantImage(data);
        
        // Inicializar mapa del restaurante
        if (data.latitud && data.longitud) {
          this.location = { lat: data.latitud, lng: data.longitud };
          this.markers = [{
            lat: data.latitud,
            lng: data.longitud,
            nombre: data.nombre,
            data
          }];
        }

        this.cargarPromocionesDashboard();
        this.cargarStatsDashboard(event);
      },
      error: (err) => {
        console.error('[DASHBOARD] Error cargando perfil del restaurante:', err);
        this.error = true;
        this.isLoading = false;
        if (event) event.target.complete();
      }
    });
  }

  cargarPromocionesDashboard(event?: any) {
    // 2. Recompensas/Promociones (Petición secundaria)
    try {
      this.restaurantService.getPromociones().subscribe({
        next: (data) => {
          this.promociones = data || [];
          this.isLoading = false;
          if (event) event.target.complete();
        },
        error: (err) => {
          // BLINDAJE: Si fallan las recompensas, NO redirigimos ni bloqueamos el dashboard
          console.error('[DASHBOARD] Error 401 o fallo de carga en promociones:', err);
          console.warn('[DASHBOARD] Ignorando error para mantener la sesión abierta.');
          this.promociones = []; 
          this.isLoading = false;
          if (event) event.target.complete();
        }
      });
    } catch (e) {
      console.error('[DASHBOARD] Error síncrono al llamar a promociones:', e);
      this.isLoading = false;
    }
  }

  cargarStatsDashboard(event?: any) {
    if (!this.business?.id) return;
    
    this.restauranteService.getDashboardStats(this.business.id).subscribe({
      next: (stats) => {
        this.activityStats = stats;
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: (err) => {
        console.error('[DASHBOARD] Error cargando estadísticas:', err);
        this.isLoading = false;
        if (event) event.target.complete();
      }
    });
  }

  async openCreatePromoModal() {
    const modal = await this.modalCtrl.create({
      component: FormPromocionComponent
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.cargarDatos(); // Recargar para ver la nueva promo si aplica
    }
  }
}
