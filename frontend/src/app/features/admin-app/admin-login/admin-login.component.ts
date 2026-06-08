import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, arrowForwardOutline, lockClosedOutline, mailOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  constructor() {
    addIcons({ arrowBackOutline, arrowForwardOutline, lockClosedOutline, mailOutline, shieldCheckmarkOutline });
  }

  async doLogin(): Promise<void> {
    if (this.loginForm.invalid) return;

    const loading = await this.loadingCtrl.create({ message: 'Verificando acceso interno...' });
    await loading.present();

    this.authService.loginAdmin(this.loginForm.value).subscribe({
      next: () => loading.dismiss(),
      error: async (err) => {
        await loading.dismiss();
        console.error('[ADMIN LOGIN ERROR]', {
          status: err.status,
          statusText: err.statusText,
          url: err.url,
          error: err.error,
          message: err.message
        });

        let message = err.error?.message || 'Credenciales de administrador no válidas.';

        if (err.status === 0) {
          message = 'Backend no disponible en http://localhost:8081. Arranca Spring Boot y vuelve a intentarlo.';
        } else if (err.status === 404) {
          message = err.error?.message || 'No existe un administrador con ese email.';
        } else if (err.status === 400 || err.status === 401) {
          message = err.error?.message || 'Credenciales de administrador no válidas.';
        } else if (err.status >= 500) {
          message = err.error?.message || 'Error interno del backend durante el login admin.';
        }

        const toast = await this.toastCtrl.create({
          message,
          duration: 3500,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    });
  }
}
