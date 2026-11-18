import { Component, OnInit, OnDestroy, inject } from '@angular/core';
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
import { CanjeService, CanjePendiente } from '../../../core/services/canje.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { RouterLink } from '@angular/router';
import { CustomerI18nService } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-recompensas',
  templateUrl: './recompensas.component.html',
  styleUrls: ['./recompensas.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe, SafeRestaurantImageDirective]
})
export class RecompensasComponent implements OnInit, OnDestroy {
  private promocionService = inject(PromocionService);
  private canjeService = inject(CanjeService);
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
  private procesandoCanje = false;

  canjeEnCurso: (CanjePendiente & { qrDataUrl?: string; segundosRestantes?: number }) | null = null;
  private canjePolling?: any;
  private canjeCuentaAtras?: any;

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
        if (user?.puntos != null) {
          this.userPoints = user.puntos;
        } else if (user?.id != null) {
          // Al recargar directo en esta ruta el estado en memoria está vacío:
          // pedimos el saldo real para no mostrar todo el catálogo bloqueado.
          this.usuarioService.getUsuarioById(user.id).subscribe(data2 => {
            this.globalState.setState({ ...user, id: user.id!, puntos: data2.puntos });
            this.userPoints = data2.puntos;
          });
        }
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
    if (this.procesandoCanje) return; // Evita doble-gasto por doble click / alert apilado
    this.procesandoCanje = true;
    const user = this.globalState.getState();
    if (!user?.id) return;

    const loading = await this.loadingCtrl.create({ message: this.i18n.instant('rewards.processing') });
    await loading.present();

    this.canjeService.canjear(recompensa.id).subscribe({
      next: async (canje) => {
        this.procesandoCanje = false;
        await loading.dismiss();
        this.refrescarSaldo();
        await this.mostrarQrCanje(canje);
      },
      error: async (err) => {
        this.procesandoCanje = false;
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: err.error?.message || this.i18n.instant('rewards.insufficient'),
          duration: 3000, color: 'danger'
        });
        toast.present();
      }
    });
  }

  /** Modal con el QR temporal que el camarero escanea para validar el canje. */
  private async mostrarQrCanje(canje: CanjePendiente) {
    let qrDataUrl: string | undefined;
    try {
      qrDataUrl = await QRCode.toDataURL(canje.codigo, { width: 480, margin: 1 });
    } catch { /* el modal muestra el código textual como respaldo */ }
    this.canjeEnCurso = { ...canje, qrDataUrl, segundosRestantes: canje.expiraEn };

    this.pararPollingCanje();
    this.canjePolling = setInterval(() => this.canjeService.estado(canje.id).subscribe({
      next: (estado) => {
        if (estado.estado === 'VALIDADO' && this.canjeEnCurso) {
          this.finalizarCanje(this.i18n.instant('rewards.canje.validado'), 'success');
          this.refrescarSaldo();
        }
      },
      error: () => { /* seguimos esperando */ }
    }), 4000);

    this.canjeCuentaAtras = setInterval(() => {
      if (!this.canjeEnCurso) return;
      this.canjeEnCurso.segundosRestantes = Math.max(0, (this.canjeEnCurso.segundosRestantes || 0) - 1);
      if (this.canjeEnCurso.segundosRestantes <= 0) {
        // Nadie lo validó a tiempo: cancelamos y devolvemos los puntos.
        this.canjeService.cancelar(canje.id).subscribe({
          next: () => this.finalizarCanje(this.i18n.instant('rewards.canje.devuelto'), 'warning'),
          error: (err) => this.finalizarCanje(err.error?.message || this.i18n.instant('rewards.canje.error'), 'danger')
        });
      }
    }, 1000);
  }

  private finalizarCanje(mensaje: string, color: string) {
    this.pararPollingCanje();
    this.cerrarModalCanje();
    this.toastCtrl.create({ message: mensaje, duration: 3500, color, position: 'top' })
      .then(t => t.present());
  }

  cancelarCanjeEnCurso() {
    if (!this.canjeEnCurso) return;
    this.canjeService.cancelar(this.canjeEnCurso.id).subscribe({
      next: () => {
        this.finalizarCanje(this.i18n.instant('rewards.canje.devuelto'), 'warning');
        this.refrescarSaldo();
      },
      error: (err) => this.finalizarCanje(err.error?.message || this.i18n.instant('rewards.canje.error'), 'danger')
    });
  }

  cerrarModalCanje() {
    this.pararPollingCanje();
    this.canjeEnCurso = null;
  }

  private pararPollingCanje() {
    if (this.canjePolling) { clearInterval(this.canjePolling); this.canjePolling = undefined; }
    if (this.canjeCuentaAtras) { clearInterval(this.canjeCuentaAtras); this.canjeCuentaAtras = undefined; }
  }

  private refrescarSaldo() {
    const user = this.globalState.getState();
    if (!user?.id) return;
    this.usuarioService.getUsuarioById(user.id).subscribe(data => {
      this.globalState.setState({ ...user, id: user.id, puntos: data.puntos });
      this.userPoints = data.puntos;
    });
  }

  ngOnDestroy() {
    this.pararPollingCanje();
  }
}
