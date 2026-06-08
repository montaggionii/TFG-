import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * AUTH GUARD SÍNCRONO (INGENIERÍA SENIOR)
 * Evita parpadeos y desincronizaciones de estado al arranque.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    const role = localStorage.getItem('role');
    
    // Protección extra: Si intenta entrar a rutas de restaurante, debe ser RESTAURANT
    if (state.url.startsWith('/r/') && role !== 'ROLE_RESTAURANT') {
      console.warn(`[AUTH GUARD] Intento de acceso no autorizado a ${state.url} con rol ${role}.`);
      router.navigate(['/login']);
      return false;
    }

    if (state.url.startsWith('/admin') && role !== 'ROLE_ADMIN') {
      console.warn(`[AUTH GUARD] Intento de acceso no autorizado a ${state.url} con rol ${role}.`);
      router.navigate([role === 'ROLE_RESTAURANT' ? '/r/dashboard' : '/u/home']);
      return false;
    }

    return true;
  }

  console.warn(`[AUTH GUARD] Sin sesión activa para ${state.url}. Redirigiendo...`);
  router.navigate([state.url.startsWith('/admin') ? '/admin/login' : '/login']);
  return false;
};
