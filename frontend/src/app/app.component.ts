import { Component, inject } from '@angular/core';
import { Router, NavigationStart, NavigationError, NavigationCancel } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/theme/theme.service';

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
  }
}
