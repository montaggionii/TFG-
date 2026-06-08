import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PuntosService, UsuarioPuntos } from '../../../core/services/puntos.service';
import { AuthService } from '../../../core/auth/auth.service';
import { addIcons } from 'ionicons';
import { personOutline, starOutline, addOutline, checkmarkCircleOutline, cashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-scanner-result',
  templateUrl: './scanner-result.page.html',
  styleUrls: ['./scanner-result.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ScannerResultPage implements OnInit {
  private router = inject(Router);
  private puntosService = inject(PuntosService);
  private authService = inject(AuthService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  usuario: UsuarioPuntos | null = null;
  montoConsumido: number | null = null;
  puntosCalculados: number = 0;
  isSubmitting = false;

  constructor() {
    addIcons({ personOutline, starOutline, addOutline, checkmarkCircleOutline, cashOutline });
    const nav = this.router.getCurrentNavigation();
    this.usuario = nav?.extras.state?.['usuario'];
  }

  ngOnInit() {
    if (!this.usuario) {
      console.warn('No se recibieron datos del usuario en la navegación.');
    }
  }

  calcularPuntos() {
    // Forzamos la conversión a número para evitar errores de tipo cadena o locale
    const valor = Number(this.montoConsumido);
    if (!isNaN(valor) && valor > 0) {
      this.montoConsumido = valor;
      this.puntosCalculados = Math.floor(valor); // 1 punto = 1€
    } else {
      this.puntosCalculados = 0;
    }
  }

  async asignarPuntos() {
    if (!this.usuario || !this.montoConsumido || this.montoConsumido <= 0) return;

    // Obtener ID del restaurante logueado
    const restauranteIdStr = localStorage.getItem('userId');
    if (!restauranteIdStr) {
      const toast = await this.toastCtrl.create({
        message: 'Error crítico: No se encontró el ID del restaurante. Por favor, inicia sesión de nuevo.',
        duration: 4000,
        color: 'danger'
      });
      toast.present();
      return;
    }
    const restauranteId = Number(restauranteIdStr);

    this.isSubmitting = true;
    const loading = await this.loadingCtrl.create({
      message: 'Asignando puntos...',
      spinner: 'crescent'
    });
    await loading.present();

    const payload = {
      usuarioId: this.usuario.id,
      restauranteId: restauranteId,
      monto: this.montoConsumido,
      puntos: this.puntosCalculados
    };

    console.log("📤 ENVIANDO PUNTOS:", JSON.stringify(payload, null, 2));

    this.puntosService.sumarPuntos(payload).subscribe({
      next: async () => {
        loading.dismiss();
        this.isSubmitting = false;
        const toast = await this.toastCtrl.create({
          message: `¡${this.puntosCalculados} puntos asignados correctamente!`,
          duration: 3000,
          color: 'success',
          position: 'top',
          icon: 'checkmark-circle-outline'
        });
        toast.present();
        this.router.navigate(['/r/scanner']);
      },
      error: async (err) => {
        loading.dismiss();
        this.isSubmitting = false;
        console.error("❌ ERROR AL ASIGNAR PUNTOS:", err);
        const toast = await this.toastCtrl.create({
          message: 'Error al asignar puntos. Revisa la consola para más detalles.',
          duration: 3000,
          color: 'danger'
        });
        toast.present();
      }
    });
  }
}
