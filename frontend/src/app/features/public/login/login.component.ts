import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ["./login.component.scss"],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, RouterModule]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  loginForm: FormGroup;
  isRestaurantMode = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  toggleLoginType() {
    this.isRestaurantMode = !this.isRestaurantMode;
    console.log('[LoginComponent] Modo actual cambiado a ->', this.isRestaurantMode ? 'RESTAURANTE' : 'CLIENTE');
    this.loginForm.reset();
  }

  async doLogin() {
    if (this.loginForm.invalid) return;

    const loading = await this.loadingCtrl.create({
      message: 'Iniciando sesión...',
    });
    await loading.present();

    const credentials = this.loginForm.value;
    
    console.log(`[LoginComponent] Ejecutando login... Modo: ${this.isRestaurantMode ? 'RESTAURANTE' : 'CLIENTE'}`);
    
    const authCall = this.isRestaurantMode 
      ? this.authService.loginRestaurante(credentials)
      : this.authService.loginUsuario(credentials);

    console.log(`[LoginComponent] Usando endpoint subyacente para: ${this.isRestaurantMode ? 'login-restaurante' : 'login usuario'}`);

    authCall.subscribe({
      next: () => {
        loading.dismiss();
        console.log('[LOGIN] Sesión iniciada correctamente');
      },
      error: async (err) => {
        loading.dismiss();
        
        let errorMessage = 'Error inesperado. Inténtalo de nuevo.';
        
        if (err.status === 0) {
          errorMessage = '❌ Servidor no disponible. Verifica tu conexión a internet o la IP del backend.';
          console.error('[NETWORK ERROR] No se pudo alcanzar el backend:', err);
        } else if (err.status === 401 || err.status === 403) {
          errorMessage = '🔑 Credenciales incorrectas. Revisa tu email y contraseña.';
          console.warn('[AUTH ERROR] Credenciales rechazadas');
        } else if (err.status >= 500) {
          errorMessage = '🔥 Error interno del servidor. Por favor, contacta con soporte.';
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }

        const toast = await this.toastCtrl.create({
          message: errorMessage,
          duration: 4000,
          color: 'danger',
          position: 'bottom',
          buttons: [{ text: 'OK', role: 'cancel' }]
        });
        await toast.present();
      }
    });

  }
}
