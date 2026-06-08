import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController, LoadingController, AlertController, ModalController } from '@ionic/angular';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { PromocionService } from '../../../core/services/promocion.service';
import { PuntosService } from '../../../core/services/puntos.service';
import { GlobalStateService, UserState } from '../../../core/state/global-state.service';
import { Subscription } from 'rxjs';
import * as QRCode from 'qrcode';
import { environment } from '../../../../environments/environment';
import { CustomerI18nService } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';
import { addIcons } from 'ionicons';
import { 
  locationOutline, 
  restaurantOutline, 
  star, 
  informationCircleOutline, 
  giftOutline, 
  navigateOutline, 
  arrowBackOutline,
  callOutline,
  closeOutline,
  flashlightOutline,
  checkmarkCircleOutline,
  receiptOutline,
  calendarOutline,
  alertCircleOutline,
  ticketOutline,
  trendingUpOutline,
  qrCodeOutline,
  sparklesOutline,
  trophyOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-restaurante-detalle',
  templateUrl: './restaurante-detalle-page.component.html',
  styleUrls: ['./restaurante-detalle-page.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, CustomerTranslatePipe, SafeRestaurantImageDirective]
})
export class RestauranteDetallePageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private restauranteService = inject(RestauranteService);
  private promocionService = inject(PromocionService);
  private puntosService = inject(PuntosService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private modalCtrl = inject(ModalController);
  private i18n = inject(CustomerI18nService);

  restaurante: any = null;
  promociones: any[] = [];
  isRestaurantBalanceLoading = false;
  
  private _ptsRestaurante: number | undefined = undefined;
  
  get ptsRestaurante(): number | undefined {
    return this._ptsRestaurante;
  }

  set ptsRestaurante(val: number | undefined) {
    this._ptsRestaurante = val;
  }

  error: boolean = false;
  distanciaKM: string = '0.0';
  apiUrl = environment.apiUrl;
  user: UserState | null = null;

  isQrModalOpen = false;
  isEarnPromoDetailOpen = false;
  isSuccessModalOpen = false;
  selectedPromo: any = null;
  voucherCode: string = '';
  isErrorModalOpen = false;
  errorMessage: string = '';
  redemptionDate: string = '';
  previousPoints: number = 0;
  
  private restauranteIdFromUrl: number | null = null;
  private userStateSub: Subscription | null = null;
  
  @ViewChild('promoQrCanvas') promoQrCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('successModal') successModal!: any;
  @ViewChild('errorModal') errorModal!: any;

  constructor() {
    addIcons({ 
      locationOutline, 
      restaurantOutline, 
      star, 
      informationCircleOutline, 
      giftOutline, 
      navigateOutline, 
      arrowBackOutline,
      callOutline,
      closeOutline,
      flashlightOutline,
      checkmarkCircleOutline,
      receiptOutline,
      calendarOutline,
      alertCircleOutline,
      ticketOutline,
      trendingUpOutline,
      qrCodeOutline,
      sparklesOutline,
      trophyOutline
    });
  }

  ngOnInit() {
    // 1. Captura REACTIVA del ID de la ruta (Mucho más fiable en Ionic)
    this.route.paramMap.subscribe((params: any) => {
      const id = params.get('id');
      this.restauranteIdFromUrl = id ? Number(id) : null;
      
      if (this.user && this.restauranteIdFromUrl) {
        this.sincronizarPuntos();
      }
    });

    // 2. Suscripción al estado del usuario
    this.userStateSub = this.globalState.userState$.subscribe((user: UserState | null) => {
      this.user = user;
      
      if (user && user.id && this.restauranteIdFromUrl) {
        this.sincronizarPuntos();
      }
    });

    // 3. Captura de query params
    this.route.queryParams.subscribe((params: any) => {
      if (params['distancia']) this.distanciaKM = params['distancia'];
      if (params['tab'] === 'promos') setTimeout(() => this.scrollToPromos(), 1000);
    });

    const idStr = this.route.snapshot.paramMap.get('id');
    if (idStr) {
      this.cargarRestaurante(idStr);
      this.cargarPromociones(idStr);
    }
  }

  ngOnDestroy() {
    this.userStateSub?.unsubscribe();
  }

  scrollToPromos() {
    const el = document.querySelector('.promotions-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  sincronizarPuntos() {
    const currentUser = this.globalState.getState();
    const uId = currentUser?.id;
    const rId = this.restauranteIdFromUrl;

    if (!uId || !rId) {
      console.warn('[PUNTOS SYNC] Abortado: Falta ID de usuario o restaurante', { uId, rId });
      return;
    }

    this.isRestaurantBalanceLoading = true;
    
    this.puntosService.getPuntosPorRestaurante(uId, rId).subscribe({
      next: (res: any) => {
        this.ptsRestaurante = Number(res?.puntos ?? 0);
        this.isRestaurantBalanceLoading = false;
        
        // Forzar renderizado profundo
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        setTimeout(() => this.cdr.detectChanges(), 150);
      },
      error: (err: any) => {
        console.error('[SALDO RESTAURANTE RESPONSE] ERROR', err);
        this.isRestaurantBalanceLoading = false;
        // NO seteamos a 0. Mantenemos el estado anterior o undefined para no engañar al usuario
        this.cdr.detectChanges();
      }
    });
  }

  cargarRestaurante(id: string) {
    this.restauranteService.getRestauranteById(Number(id)).subscribe({
      next: (data: any) => {
        this.restaurante = {
          ...data,
          imagenUrl: this.restauranteService.resolveRestaurantImage(data)
        };
        this.sincronizarPuntos();
      },
      error: (err: any) => {
        this.error = true;
        this.mostrarToast(this.i18n.instant('restaurant.toast.loadError'), 'danger');
      }
    });
  }

  cargarPromociones(id: string) {
    this.promocionService.getPromocionesByRestaurante(Number(id)).subscribe({
      next: (data: any[]) => {
        this.promociones = data.map((p: any) => {
          const restaurantFallback = p.restaurante || this.restaurante || {
            id: Number(id),
            nombre: this.restaurante?.nombre
          };

          return {
            ...p,
            imagenUrl: this.restauranteService.resolvePromotionImage(p, restaurantFallback)
          };
        });
        this.auditPromociones(this.promociones);
      },
      error: (err: any) => console.error('[PROMOS ERROR]', err)
    });
  }

  async canjearPromo(promo: any) {
    this.selectedPromo = promo;
    const audit = this.getPromotionTypeAudit(promo);
    const clasificacion = audit.clasificacion;
    const accion = clasificacion === 'GANAR'
      ? 'ABRIR_MODAL_GANAR_PUNTOS'
      : clasificacion === 'CANJEAR'
        ? 'ABRIR_FLUJO_CANJE'
        : 'MOSTRAR_TIPO_INVALIDO';

    console.log('[PROMO CLICK RAW]', promo);
    console.log('[PROMO TIPO RAW]', audit.rawValue);
    console.log('[PROMO TIPO NORMALIZADO]', audit.normalizedValue);
    console.log('[PROMO CLASIFICACION]', clasificacion);
    console.log('[PROMO ACCION]', accion);

    if (clasificacion === 'GANAR') {
      this.abrirDetalleGanarPuntos(promo);
      return;
    }

    if (clasificacion === 'INVALIDA') {
      console.warn('[PROMO TYPE] Tipo de promoción no reconocido en detalle restaurante', promo);
      this.mostrarToast(this.i18n.instant('restaurant.toast.unknownPromoType'), 'warning');
      return;
    }

    console.log('[CANJE VALIDATION]', {
      usuarioId: this.globalState.getState()?.id,
      restauranteId: this.restauranteIdFromUrl,
      promocionId: promo.id,
      puntosNecesarios: promo.puntosNecesarios,
      saldoRestaurante: this.ptsRestaurante,
      saldoCargando: this.isRestaurantBalanceLoading
    });

    if (this.ptsRestaurante === undefined) {
      this.mostrarToast(this.i18n.instant('restaurant.loadingBalance'), 'warning');
      return;
    }

    if (!this.hasEnoughRestaurantPoints(promo)) {
      this.mostrarToast(this.i18n.instant('rewards.insufficient'), 'warning');
      return;
    }

    const accionTexto = this.i18n.instant('restaurant.alert.actionRedeem');
    const alert = await this.alertCtrl.create({
      header: this.i18n.instant('restaurant.alert.confirmTitle'),
      message: this.i18n.instant('restaurant.alert.message', { action: accionTexto, promo: promo.titulo }),
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        { text: this.i18n.instant('common.confirm'), handler: () => this.ejecutarCanje(promo) }
      ]
    });
    await alert.present();
  }

  async ejecutarCanje(promo: any) {
    const user = this.globalState.getState();
    if (!user?.id) return;

    const loading = await this.loadingCtrl.create({ message: this.i18n.instant('rewards.processing') });
    await loading.present();

    this.previousPoints = this.ptsRestaurante ?? 0;

    this.promocionService.canjearPromocion(user.id, promo.id).subscribe({
      next: async (res: any) => {
        await loading.dismiss();
        console.log('[CANJE SUCCESS]', res);
        
        if (!res || typeof res !== 'object') {
          this.errorMessage = this.i18n.instant('restaurant.toast.invalidResponse');
          this.isErrorModalOpen = true;
          return;
        }

        this.voucherCode = res.codigo || `VOU-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        this.redemptionDate = new Date().toLocaleString(this.i18n.currentLanguage === 'en' ? 'en-US' : this.i18n.currentLanguage);
        this.ptsRestaurante = Number(res.saldoActual ?? res.saldoRestaurante ?? this.ptsRestaurante ?? 0);
        this.globalState.updatePuntos(res.saldoGlobal !== undefined ? Number(res.saldoGlobal) : Number(user.puntos ?? 0));

        this.ngZone.run(async () => {
          this.isSuccessModalOpen = true;
          if (this.successModal) {
            await this.successModal.present();
          } else {
            const domModal = document.querySelector('ion-modal.success-receipt') as any;
            if (domModal?.present) await domModal.present();
          }
          this.cdr.detectChanges();
        });
      },
      error: async (err: any) => {
        await loading.dismiss();
        this.ptsRestaurante = this.previousPoints;
        this.errorMessage = err.error?.message || err.error || this.i18n.instant('restaurant.toast.redeemError');
        this.isErrorModalOpen = true;
      }
    });
  }

  hasEnoughRestaurantPoints(promo: any): boolean {
    if (this.clasificarPromocion(promo) !== 'CANJEAR') return true;
    if (this.ptsRestaurante === undefined) return false;
    return this.ptsRestaurante >= Number(promo.puntosNecesarios ?? 0);
  }

  isRedeemDisabled(promo: any): boolean {
    return this.isRestaurantBalanceLoading || !this.hasEnoughRestaurantPoints(promo);
  }

  isEarnPromotion(promo: any): boolean {
    return this.clasificarPromocion(promo) === 'GANAR';
  }

  isRedeemPromotion(promo: any): boolean {
    return this.clasificarPromocion(promo) === 'CANJEAR';
  }

  isInvalidPromotion(promo: any): boolean {
    return this.clasificarPromocion(promo) === 'INVALIDA';
  }

  abrirDetalleGanarPuntos(promo: any) {
    this.selectedPromo = promo;
    this.isEarnPromoDetailOpen = true;
  }

  mostrarQrGanarPuntos(promo: any) {
    console.log('[GANAR PUNTOS QR]', {
      promocionId: promo?.id,
      tipo: promo?.tipo,
      puntos: promo?.puntosNecesarios,
      usuarioId: this.user?.id,
      restauranteId: this.restauranteIdFromUrl
    });
    this.selectedPromo = promo;
    this.isEarnPromoDetailOpen = false;
    this.isQrModalOpen = true;
    setTimeout(() => this.generatePromoQR(), 300);
  }

  clasificarPromocion(promocion: any): 'GANAR' | 'CANJEAR' | 'INVALIDA' {
    return this.getPromotionTypeAudit(promocion).clasificacion;
  }

  private getPromotionTypeAudit(promocion: any): {
    field: string;
    rawValue: any;
    normalizedValue: string;
    clasificacion: 'GANAR' | 'CANJEAR' | 'INVALIDA';
  } {
    const earnTypes = new Set([
      'GANAR',
      'GANADOS',
      'GANAR_PUNTOS',
      'GANAR_PTS',
      'SUMA',
      'SUMAR',
      'SUMAR_PUNTOS',
      'ACUMULAR',
      'ACUMULAR_PUNTOS',
      'ACUMULACION',
      'ABONO',
      'EARN',
      'EARN_POINTS'
    ]);
    const redeemTypes = new Set([
      'CANJEAR',
      'CANJE',
      'CANJEADOS',
      'CANJEAR_RECOMPENSA',
      'CANJEAR_PUNTOS',
      'RECOMPENSA',
      'REDEEM',
      'REDEEM_POINTS'
    ]);
    const fields = ['tipo', 'tipoPromocion', 'categoria', 'modo', 'accion', 'tipoMovimiento'];

    for (const field of fields) {
      const rawValue = promocion?.[field];
      const normalizedValue = this.normalizePromotionTypeValue(rawValue);
      if (!normalizedValue) continue;
      if (earnTypes.has(normalizedValue) || normalizedValue.includes('GANAR') || normalizedValue.includes('SUMA') || normalizedValue.includes('ACUMULAR') || normalizedValue.includes('EARN')) {
        return { field, rawValue, normalizedValue, clasificacion: 'GANAR' };
      }
      if (redeemTypes.has(normalizedValue) || normalizedValue.includes('CANJE') || normalizedValue.includes('RECOMPENSA') || normalizedValue.includes('REDEEM')) {
        return { field, rawValue, normalizedValue, clasificacion: 'CANJEAR' };
      }
    }

    return {
      field: 'tipo',
      rawValue: promocion?.tipo,
      normalizedValue: this.normalizePromotionTypeValue(promocion?.tipo),
      clasificacion: 'INVALIDA'
    };
  }

  private normalizePromotionTypeValue(value: any): string {
    if (value && typeof value === 'object') {
      const objectCandidate = ['tipo', 'nombre', 'name', 'value', 'codigo', 'code']
        .map((key) => this.normalizePromotionTypeValue(value[key]))
        .find(Boolean);

      if (objectCandidate) return objectCandidate;
    }

    return String(value ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private auditPromociones(promociones: any[]) {
    console.table(promociones.map((promo: any) => {
      const audit = this.getPromotionTypeAudit(promo);
      return {
        id: promo?.id,
        titulo: promo?.titulo,
        tipo: promo?.tipo,
        tipoPromocion: promo?.tipoPromocion,
        categoria: promo?.categoria,
        modo: promo?.modo,
        accion: promo?.accion,
        tipoMovimiento: promo?.tipoMovimiento,
        puntosOtorgados: promo?.puntosOtorgados,
        puntosNecesarios: promo?.puntosNecesarios,
        restauranteId: promo?.restauranteId ?? promo?.restaurante?.id,
        imagen: promo?.imagen ?? promo?.imagenUrl,
        campoTipoUsado: audit.field,
        tipoNormalizado: audit.normalizedValue,
        clasificacion: audit.clasificacion
      };
    }));
  }

  verHistorial() {
    this.isSuccessModalOpen = false;
    this.router.navigate(['/u/historial']);
  }

  cerrarModalExito() {
    this.isSuccessModalOpen = false;
  }

  async generatePromoQR() {
    if (!this.user || !this.promoQrCanvas) return;
    const qrText = `FIDELITY_ID:${this.user.id}`;
    try {
      await QRCode.toCanvas(this.promoQrCanvas.nativeElement, qrText, {
        margin: 2,
        width: 260,
        color: { dark: '#050505', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      });
    } catch (err) {
      console.error('QR Error', err);
    }
  }

  abrirMaps() {
    if (!this.restaurante?.direccion) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.restaurante.direccion)}`, '_blank');
  }

  goBack() {
    this.router.navigate(['/u/mapa']);
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({ message, duration: 2000, color });
    await toast.present();
  }

  resolverImagen(path: string | null): string {
    return this.restauranteService.resolverImagenUrl(path);
  }
}
