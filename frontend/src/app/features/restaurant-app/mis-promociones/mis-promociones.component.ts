import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController, ModalController, AlertController } from '@ionic/angular';
import { PromocionService } from '../../../core/services/promocion.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { FormPromocionComponent } from './form-promocion/form-promocion.component';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';
import { addIcons } from 'ionicons';
import { 
  addCircleOutline, 
  megaphoneOutline, 
  add, 
  createOutline, 
  trashOutline, 
  imageOutline,
  alertCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-mis-promociones',
  templateUrl: './mis-promociones.component.html',
  styleUrls: ['./mis-promociones.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, SafeRestaurantImageDirective]
})
export class MisPromocionesComponent implements OnInit {
  private promocionService = inject(PromocionService);
  private restauranteService = inject(RestauranteService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);

  promos: any[] = [];
  isLoading = true;

  constructor() {
    addIcons({ 
      addCircleOutline, 
      megaphoneOutline, 
      add, 
      createOutline, 
      trashOutline, 
      imageOutline,
      alertCircleOutline
    });
  }

  ngOnInit() {
    this.loadPromos();
  }

  loadPromos(event?: any) {
    if (!event) this.isLoading = true;
    
    const state = this.globalState.getState();
    const restauranteId = state?.id;

    if (!restauranteId) {
      this.isLoading = false;
      this.mostrarToast('No se pudo identificar el restaurante', 'danger');
      return;
    }

    this.promocionService.getPromocionesByRestaurante(restauranteId).subscribe({
      next: (data) => {
        console.log(`📦 FRONTEND - Cargadas ${data.length} promos para el restaurante ID: ${restauranteId}`);
        this.promos = data.map(p => {
          return {
            ...p,
            imagenUrl: this.restauranteService.resolvePromotionImage(p, {
              id: restauranteId,
              nombre: state?.nombre
            })
          };
        });
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: async () => {
        this.isLoading = false;
        if (event) event.target.complete();
        this.mostrarToast('Error al cargar promociones', 'danger');
      }
    });
  }

  async openCreateModal() {
    const modal = await this.modalCtrl.create({
      component: FormPromocionComponent
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.loadPromos();
    }
  }

  async editarPromo(promo: any) {
    const modal = await this.modalCtrl.create({
      component: FormPromocionComponent,
      componentProps: { promo: { ...promo } } // Pasar copia de la promo
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.loadPromos();
    }
  }

  async eliminarPromo(id: number) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que deseas eliminar esta promoción? Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.ejecutarEliminacion(id);
          }
        }
      ]
    });

    await alert.present();
  }

  private async ejecutarEliminacion(id: number) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando...' });
    await loading.present();

    this.promocionService.deletePromocion(id).subscribe({
      next: () => {
        loading.dismiss();
        this.mostrarToast('Promoción eliminada con éxito', 'success');
        this.loadPromos();
      },
      error: (err) => {
        loading.dismiss();
        this.mostrarToast('Error al eliminar la promoción', 'danger');
      }
    });
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2000,
      position: 'top'
    });
    toast.present();
  }
}
