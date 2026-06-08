import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  walletOutline, 
  alertCircleOutline, 
  giftOutline, 
  star, 
  restaurantOutline, 
  ticketOutline, 
  lockClosedOutline,
  arrowForwardOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { PromocionService } from '../../../core/services/promocion.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { RouterLink } from '@angular/router';
import { CustomerI18nService } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';

@Component({
  selector: 'app-recompensas',
  templateUrl: './recompensas.component.html',
  styleUrls: ['./recompensas.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe, SafeRestaurantImageDirective]
})
export class RecompensasComponent implements OnInit {
  private promocionService = inject(PromocionService);
  private usuarioService = inject(UsuarioService);
  private restauranteService = inject(RestauranteService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private i18n = inject(CustomerI18nService);

  constructor() {
    addIcons({ 
      walletOutline, 
      alertCircleOutline, 
      giftOutline, 
      star, 
      restaurantOutline, 
      ticketOutline, 
      lockClosedOutline,
      arrowForwardOutline,
      chevronForwardOutline
    });
  }

  recompensasAgrupadas: any[] = [];
  isLoading = true;
  error = false;
  userPoints = 0;

  ngOnInit() {
    this.cargarDatos();
  }

  ionViewWillEnter() {
    const user = this.globalState.getState();
    if (user) {
      this.userPoints = user.puntos || 0;
    }
  }

  cargarDatos(event?: any) {
    if (!event) this.isLoading = true;
    this.error = false;
    
    this.promocionService.getPromociones().subscribe({
      next: (data) => {
        this.procesarRecompensas(data);
        const user = this.globalState.getState();
        this.userPoints = user?.puntos || 0;
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: async () => {
        this.error = true;
        this.isLoading = false;
        if (event) event.target.complete();
      }
    });
  }

  private procesarRecompensas(promos: any[]) {
    // 1. Filtrar solo las que son de tipo CANJEAR (recompensas)
    const recompensasRaw = promos.filter(p => p.tipo === 'CANJEAR');
    
    // 2. Agrupar por restaurante
    const grupos: { [key: string]: any } = {};
    
    recompensasRaw.forEach(p => {
      const restId = p.restaurante?.id || p.restauranteId || 'unknown';
      const restName = p.restaurante?.nombre || p.nombreRestaurante || 'Restaurante';
      
      if (!grupos[restId]) {
        grupos[restId] = {
          restaurantId: restId,
          restaurantName: restName,
          items: []
        };
      }

      grupos[restId].items.push({
        ...p,
        puntosCoste: p.puntosNecesarios || p.puntos || 0,
        imageUrl: this.restauranteService.resolvePromotionImage(p, { id: restId, nombre: restName })
      });
    });

    this.recompensasAgrupadas = Object.values(grupos);
  }

  refrescar(event: any) {
    this.cargarDatos(event);
  }

  async confirmarCanje(recompensa: any, event: Event) {
    event.stopPropagation(); // Evitar navegar al restaurante
    const alert = await this.alertCtrl.create({
      header: this.i18n.instant('rewards.confirm.title'),
      message: this.i18n.instant('rewards.confirm.message', { points: recompensa.puntosCoste, reward: recompensa.titulo }),
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        { text: this.i18n.instant('actions.redeem'), handler: () => { this.ejecutarCanje(recompensa); } }
      ]
    });
    await alert.present();
  }

  private async ejecutarCanje(recompensa: any) {
    const user = this.globalState.getState();
    if (!user?.id) return;

    const loading = await this.loadingCtrl.create({ message: this.i18n.instant('rewards.processing') });
    await loading.present();

    this.promocionService.canjearPromocion(user.id, recompensa.id).subscribe({
      next: async () => {
        // Actualizar puntos
        this.usuarioService.getUsuarioById(user.id!).subscribe(data => {
          this.globalState.setState({ ...user, puntos: data.puntos });
          this.userPoints = data.puntos;
        });
        
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: this.i18n.instant('rewards.success'),
          duration: 3000, color: 'success', position: 'top'
        });
        toast.present();
      },
      error: async (err) => {
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: err.error?.message || this.i18n.instant('rewards.insufficient'),
          duration: 3000, color: 'danger'
        });
        toast.present();
      }
    });
  }
}
