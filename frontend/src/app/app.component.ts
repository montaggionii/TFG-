import { Component, inject } from '@angular/core';
import { Router, NavigationStart, NavigationError, NavigationCancel } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/theme/theme.service';
import { App as CapApp } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private router = inject(Router);
  private themeService = inject(ThemeService);

  constructor() {
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

    // Deep links nativos (fidelyfood:// y atajos iOS tipo fidelyfood.qr):
    // atajos del icono de la app, enlaces compartidos y widgets.
    CapApp.addListener('appUrlOpen', ({ url }) => {
      const match = /(?:fidelyfood:\/\/|fidelyfood\.)([a-z]+)/.exec(url);
      if (!match) return;
      const destino = match[1].split('?')[0];
      const rutasValidas = ['qr', 'reservas', 'recompensas', 'mapa', 'historial'];
      if (rutasValidas.includes(destino)) {
        this.router.navigate([`/u/${destino}`]);
      }
    });
  }
}
