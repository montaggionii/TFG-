import { Routes } from '@angular/router';
import { UserLayoutComponent } from './user-layout.component';

export const userRoutes: Routes = [
  {
    path: '',
    component: UserLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'historial',
        loadComponent: () => import('./historial/historial.component').then(m => m.HistorialComponent)
      },
      {
        path: 'mapa',
        loadComponent: () => import('./mapa/mapa-page.component').then(m => m.MapaPageComponent)
      },
      {
        path: 'restaurante/:id',
        loadComponent: () => import('./restaurante-detalle/restaurante-detalle-page.component').then(m => m.RestauranteDetallePageComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.component').then(m => m.PerfilComponent)
      },
      {
        path: 'privacy',
        loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent)
      },
      {
        path: 'terms',
        loadComponent: () => import('./terms/terms.component').then(m => m.TermsComponent)
      },
      {
        path: 'security',
        loadComponent: () => import('./security-center/security-center.component').then(m => m.SecurityCenterComponent)
      },
      {
        path: 'recompensas',
        loadComponent: () => import('./recompensas/recompensas.component').then(m => m.RecompensasComponent)
      }
    ]
  }
];
