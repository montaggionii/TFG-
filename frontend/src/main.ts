import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules, withEnabledBlockingInitialNavigation } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { defineCustomElements } from '@ionic/core/loader';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { tokenInterceptor } from './app/core/auth/token.interceptor';

import { addIcons } from 'ionicons';
import { 
  alertCircle, 
  add, 
  closeOutline, 
  imageOutline, 
  pricetagOutline, 
  checkmarkCircle, 
  documentTextOutline, 
  starOutline, 
  cloudUploadOutline, 
  closeCircle, 
  linkOutline, 
  arrowForward,
  star
} from 'ionicons/icons';

// Registro global de iconos para evitar errores de carga
addIcons({
  alertCircle,
  add,
  closeOutline,
  imageOutline,
  pricetagOutline,
  checkmarkCircle,
  documentTextOutline,
  starOutline,
  cloudUploadOutline,
  closeCircle,
  linkOutline,
  arrowForward,
  star
});

// Registra globalmente los web components de Ionic (ion-input, ion-button, ion-icon, etc.).
// Sin esto, los componentes importados vía IonicModule (@ionic/angular) nunca se
// definen como custom elements bajo bootstrapApplication + provideIonicAngular(),
// y se renderizan sin shadow DOM (0x0, sin interactividad).
defineCustomElements(window);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withEnabledBlockingInitialNavigation()),
    provideHttpClient(withInterceptors([tokenInterceptor]))
  ],
});
