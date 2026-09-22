import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { AdminLoginComponent } from './features/admin-app/admin-login/admin-login.component';
import { adminRoutes } from './features/admin-app/admin.routes';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/public/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'fidelyfood',
    loadComponent: () => import('./features/public/app-public/app-public.component').then(m => m.AppPublicComponent),
  },
  {
    path: 'admin/login',
    loadComponent: () => Promise.resolve(AdminLoginComponent),
  },
  {
    path: 'register-user',
    loadComponent: () => import('./features/public/register-user/register-user.component').then(m => m.RegisterUserComponent)
  },
  {
    path: 'register-restaurant',
    loadComponent: () => import('./features/public/register-restaurant/register-restaurant.component').then(m => m.RegisterRestaurantComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/user-app/privacy/privacy.component').then(m => m.PrivacyComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/user-app/terms/terms.component').then(m => m.TermsComponent)
  },
  {
    path: 'security-info',
    canActivate: [authGuard, roleGuard('ROLE_USER')],
    loadComponent: () => import('./features/user-app/security-center/security-center.component').then(m => m.SecurityCenterComponent)
  },
  {
    path: 'u',
    canActivate: [authGuard, roleGuard('ROLE_USER')],
    loadChildren: () => import('./features/user-app/user.routes').then(m => m.userRoutes)
  },
  {
    path: 'r',
    canActivate: [authGuard, roleGuard('ROLE_RESTAURANT')],
    loadChildren: () => import('./features/restaurant-app/restaurant.routes').then(m => m.restaurantRoutes)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('ROLE_ADMIN')],
    loadChildren: () => Promise.resolve(adminRoutes)
  }
];
