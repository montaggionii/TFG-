import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard = (role: string | string[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const allowedRoles = Array.isArray(role) ? role : [role];
    const currentRole = authService.getRoleSync();

    if (authService.isAuthenticated() && currentRole && allowedRoles.includes(currentRole)) {
      return true;
    }

    console.warn(`[ROLE GUARD] Acceso bloqueado a ${state.url}. Rol actual: ${currentRole}`);

    if (currentRole === 'ROLE_ADMIN') {
      router.navigate(['/admin/dashboard']);
    } else if (currentRole === 'ROLE_RESTAURANT') {
      router.navigate(['/r/dashboard']);
    } else if (currentRole === 'ROLE_USER') {
      router.navigate(['/u/home']);
    } else {
      router.navigate([state.url.startsWith('/admin') ? '/admin/login' : '/login']);
    }

    return false;
  };
};
