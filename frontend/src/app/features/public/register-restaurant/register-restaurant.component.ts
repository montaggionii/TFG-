import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, ToastController, NavController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../../core/auth/auth.service';
import { MapsService } from '../../../core/services/maps.service';

@Component({
  selector: 'app-register-restaurant',
  templateUrl: './register-restaurant.component.html',
  styleUrls: ['./register-restaurant.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class RegisterRestaurantComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);
  private navCtrl = inject(NavController);
  private loadingCtrl = inject(LoadingController);
  private mapsService = inject(MapsService);

  registerForm: FormGroup;

  constructor() {
    this.registerForm = this.fb.group({
      nombre: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      direccion: ['', [Validators.required]],
      ciudad: ['', [Validators.required]],
      codigoPostal: ['', [Validators.required, Validators.pattern('^[0-9]{5}$')]],
      telefono: ['', [Validators.required, Validators.pattern('^[0-9]{9,15}$')]]
    });
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.mostrarToast('Por favor, revisa los campos del formulario', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Validando ubicación y creando cuenta...',
      spinner: 'crescent'
    });
    await loading.present();

    const formValues = this.registerForm.value;
    const fullAddress = `${formValues.direccion}, ${formValues.codigoPostal} ${formValues.ciudad}`;
    
    let lat = 39.4699; // Fallback: Valencia centro
    let lng = -0.3763;

    try {
      // Intentar geocodificar la dirección real
      const coords = await this.mapsService.geocodeAddress(fullAddress);
      lat = coords.lat;
      lng = coords.lng;
      console.log('📍 Ubicación detectada para el restaurante:', coords);
    } catch (error) {
      console.warn('⚠️ No se pudo geocodificar, usando ubicación por defecto.');
    }

    const registrationData = {
      ...formValues,
      latitud: lat,
      longitud: lng
    };

    this.authService.registerRestaurante(registrationData).subscribe({
      next: async () => {
        await loading.dismiss();
        this.mostrarToast('¡Bienvenido! Tu restaurante ya es visible en el mapa.', 'success');
        this.navCtrl.navigateRoot('/login');
      },
      error: async (err: any) => {
        await loading.dismiss();
        this.mostrarToast(err.error?.message || 'Error al registrar el restaurante', 'danger');
      }
    });
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 3000,
      position: 'top'
    });
    toast.present();
  }

  goToLogin() {
    this.navCtrl.navigateBack('/login');
  }
}
