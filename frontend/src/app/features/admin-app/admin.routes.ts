import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'businesses',
        loadComponent: () => import('./businesses/admin-businesses.component').then(m => m.AdminBusinessesComponent)
      },
      {
        path: 'clients',
        loadComponent: () => import('./clients/admin-clients.component').then(m => m.AdminClientsComponent)
      },
      {
        path: 'reservations',
        loadComponent: () => import('./reservations/admin-reservations.component').then(m => m.AdminReservationsComponent)
      },
      {
        path: 'stats',
        loadComponent: () => import('./stats/admin-stats.component').then(m => m.AdminStatsComponent)
      }
    ]
  }
];
