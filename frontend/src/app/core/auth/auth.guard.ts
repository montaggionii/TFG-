import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * AUTH GUARD SÍNCRONO (INGENIERÍA SENIOR)
 * Evita parpadeos y desincronizaciones de estado al arranque.
 */
// Rutas navegables sin cuenta (modo invitado): el registro se pide solo
// al hacer una acción que lo requiere (compra, canje, reserva…).
const RUTAS_INVITADO = ['/u/mapa', '/u/restaurante/'];

export const authGuard: CanActivateFn = (route, state) => {
  // Modo invitado: mapa y ficha de restaurante sin sesión
  if (RUTAS_INVITADO.some(r => state.url.startsWith(r))) {
    return true;
  }

  const router = inject(Router);
  const authService = inject(AuthService);
  const token = localStorage.getItem('token');

  if (token && !authService.isTokenExpired(token)) {
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
  if (token) {
    authService.logout();
    return false;
  }
  router.navigate([state.url.startsWith('/admin') ? '/admin/login' : '/login']);
  return false;
};
