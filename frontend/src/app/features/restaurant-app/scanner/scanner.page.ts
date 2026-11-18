import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { QrScannerUiComponent } from '../../../shared/components/scanner-ui/scanner-ui.component';
import { PuntosService } from '../../../core/services/puntos.service';
import { CanjeService } from '../../../core/services/canje.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { addIcons } from 'ionicons';
import { qrCodeOutline, informationCircleOutline, cameraOutline, stopCircleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-scanner',
  templateUrl: './scanner.page.html',
  styleUrls: ['./scanner.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, QrScannerUiComponent]
})
export class ScannerPage {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private puntosService = inject(PuntosService);
  private canjeService = inject(CanjeService);
  private usuarioService = inject(UsuarioService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);


  constructor() {
    addIcons({ qrCodeOutline, informationCircleOutline, cameraOutline, stopCircleOutline });
  }

  async onQrDetected(qrValue: string) {
    console.log("📱 QR ESCANEADO (raw):", qrValue);
    const qrPayload = String(qrValue || '').trim();

    if (!qrPayload) {
      const toast = await this.toastCtrl.create({
        message: 'QR no válido',
        duration: 2500,
        color: 'warning',
        position: 'top'
      });
      toast.present();
      return;
    }

    // QR de canje temporal (CANJE:<id>:<token>): se valida en caja,
    // no identifica a un cliente.
    if (qrPayload.startsWith('CANJE:')) {
      this.validarCanjeEscaneado(qrPayload);
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Validando cliente...',
      spinner: 'crescent'
    });
    await loading.present();

    console.log("📤 ENVIANDO AL BACKEND: POST /api/usuarios/identificar-qr", qrPayload);
    this.puntosService.identificarUsuarioPorQr(qrPayload).subscribe({
      next: (usuario) => {
        loading.dismiss();
        
        // 🔥 RESOLUCIÓN DE IMAGEN DEL CLIENTE (SOPORTE MULTI-RED)
        if (usuario.fotoPerfil) {
          console.log(`[PROFILE IMAGE] Resolviendo foto del cliente ID=${usuario.id}: ${usuario.fotoPerfil}`);
          usuario.fotoPerfil = this.usuarioService.resolveImageUrl(usuario.fotoPerfil) || undefined;
          console.log(`[IMAGE URL] Final para renderizar: ${usuario.fotoPerfil}`);
        } else {
          console.log(`[PROFILE IMAGE] El cliente ID=${usuario.id} no tiene foto subida.`);
        }

        this.router.navigate(['resultado'], {
          relativeTo: this.route,
          state: { usuario }
        });
      },

      error: async (err) => {
        loading.dismiss();
        const backendMessage = typeof err.error === 'string' ? err.error : err.error?.message;
        const toast = await this.toastCtrl.create({
          message: backendMessage || 'QR no válido o cliente no encontrado',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        toast.present();
      }
    });
  }

  /** Valida un canje pendiente escaneando el QR temporal del cliente. */
  private async validarCanjeEscaneado(codigo: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Validando canje...',
      spinner: 'crescent'
    });
    await loading.present();

    this.canjeService.validar(codigo).subscribe({
      next: async (res) => {
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: `✅ Canje validado: ${res.titulo} — ${res.cliente} (${res.puntosGastados} pts)`,
          duration: 4000,
          color: 'success',
          position: 'top'
        });
        toast.present();
      },
      error: async (err) => {
        await loading.dismiss();
        const toast = await this.toastCtrl.create({
          message: err.error?.message || 'No se pudo validar el canje',
          duration: 4000,
          color: 'danger',
          position: 'top'
        });
        toast.present();
      }
    });
  }
}
