import { Component, inject, signal } from '@angular/core';
import { Router, NavigationStart, NavigationError, NavigationCancel } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { filter } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { fingerPrintOutline } from 'ionicons/icons';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { ThemeService } from './core/theme/theme.service';
import { App as CapApp } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppComponent {
  private router = inject(Router);
  private themeService = inject(ThemeService);

  /** Bloqueo biométrico opcional (solo app nativa, lo activa el usuario en Perfil). */
  bloqueado = signal(false);

  constructor() {
    addIcons({ fingerPrintOutline });
    // RASTREO GLOBAL DE REDIRECCIONES - DEBUGGING EXTREMO
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        console.warn(`[NAVIGATION] Inicio -> Destino: ${event.url} | ID: ${event.id} | Trigger: ${event.navigationTrigger}`);
      }
      if (event instanceof NavigationError) {
        console.error(`[NAVIGATION] Error -> ${event.error}`);
      }
      if (event instanceof NavigationCancel) {
        console.warn(`[NAVIGATION] Cancelada -> Motivo: ${event.reason}`);
      }
    });

    console.log('[AppComponent] Listener de navegación global activo.');

    // Bloqueo biométrico al arrancar la app nativa (Face ID / huella / PIN).
    if (Capacitor.isNativePlatform() && localStorage.getItem('biometria') === '1') {
      void this.autenticarAlArrancar();
    }

    // Deep links nativos (fidelyfood:// y atajos iOS tipo fidelyfood.qr):
    // atajos del icono, enlaces compartidos, etiquetas NFC en las mesas.
    CapApp.addListener('appUrlOpen', ({ url }) => {
      const match = /(?:fidelyfood:\/\/|fidelyfood\.)([a-z]+)(?:\/([0-9]+))?/.exec(url);
      if (!match) return;
      const [, destino, id] = match;
      if (destino === 'restaurante' && id) {
        this.router.navigate(['/u/restaurante', id]);
        return;
      }
      const rutasValidas = ['qr', 'reservas', 'recompensas', 'mapa', 'historial'];
      if (rutasValidas.includes(destino)) {
        this.router.navigate([`/u/${destino}`]);
      }
    });
  }

  private async autenticarAlArrancar(): Promise<void> {
    try {
      const biometria = await BiometricAuth.checkBiometry();
      if (!biometria.isAvailable) return; // sin biometría enrolada: no bloquea
      this.bloqueado.set(true);
      await this.autenticar();
    } catch {
      // Cualquier error de comprobación no debe dejar la app inutilizable
      this.bloqueado.set(false);
    }
  }

  async autenticar(): Promise<void> {
    try {
      await BiometricAuth.authenticate({
        allowDeviceCredential: true, // respaldo: PIN/patrón del dispositivo
        reason: 'Desbloquea FidelyFood para ver tus puntos',
      });
      this.bloqueado.set(false);
    } catch {
      this.bloqueado.set(true); // reintenta desde el botón del overlay
    }
  }
}
