import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { RestaurantService } from '../../../core/services/restaurant.service';

@Component({
  selector: 'app-gestion-promos',
  templateUrl: './gestion-promos.component.html',
  styleUrls: ['./gestion-promos.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class GestionPromosComponent {
  private fb = inject(FormBuilder);
  private restaurantService = inject(RestaurantService);
  private toastCtrl = inject(ToastController);

  promoForm: FormGroup;
  previewUrl: string | null = null;
  isSubmitting = false;

  constructor() {
    this.promoForm = this.fb.group({
      nombre: ['', [Validators.required]],
      descripcion: ['', [Validators.required]],
      puntosRequeridos: [null, [Validators.required, Validators.min(1)]],
      imagenUrl: ['', [Validators.required]]
    });
  }

  showPreview() {
    this.previewUrl = this.promoForm.get('imagenUrl')?.value;
  }

  async onSubmit() {
    if (this.promoForm.invalid) return;

    this.isSubmitting = true;
    const formData = this.promoForm.value;

    this.restaurantService.crearPromocion(formData).subscribe({
      next: async (res) => {
        this.isSubmitting = false;
        const toast = await this.toastCtrl.create({
          message: '¡Promoción publicada con éxito!',
          duration: 3000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
        
        this.promoForm.reset();
        this.previewUrl = null;
      },
      error: async (err) => {
        this.isSubmitting = false;
        const toast = await this.toastCtrl.create({
          message: 'Error al crear la promoción: ' + (err.error?.message || 'Error del servidor'),
          duration: 3000,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    });
  }
}
