import { Routes } from '@angular/router';
import { RestaurantLayoutComponent } from './restaurant-layout.component';

export const restaurantRoutes: Routes = [
  {
    path: '',
    component: RestaurantLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'analiticas',
        loadComponent: () => import('./analiticas/analiticas.component').then(m => m.AnaliticasComponent)
      },
      {
        path: 'scanner',
        loadComponent: () => import('./scanner/scanner.page').then(m => m.ScannerPage)
      },
      {
        path: 'scanner/resultado',
        loadComponent: () => import('./scanner/scanner-result.page').then(m => m.ScannerResultPage)
      },
      {
        path: 'promociones',
        loadComponent: () => import('./mis-promociones/mis-promociones.component').then(m => m.MisPromocionesComponent)
      },
      {
        path: 'gestion-promos',
        loadComponent: () => import('./gestion-promos/gestion-promos.component').then(m => m.GestionPromosComponent)
      },
      {
        path: 'actividad',
        loadComponent: () => import('./activity-history/activity-history.component').then(m => m.ActivityHistoryComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  }
];
