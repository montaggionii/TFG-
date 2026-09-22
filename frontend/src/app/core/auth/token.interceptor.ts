import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Interceptor de Tokens Blindado - Ingeniería Senior
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  // Sincronización del Token: Obtenemos el valor más fresco del localStorage
  const token = localStorage.getItem('token');

  // Una petición solo pertenece a la API propia de FidelyFood si su URL empieza
  // por environment.apiUrl (el mismo origen que usan todos los servicios del
  // backend). Peticiones a dominios externos (Google Maps/Geolocation, CDNs,
  // assets relativos del propio frontend, etc.) NUNCA deben llevar nuestro JWT
  // ni pueden disparar logout/redirección de sesión ante un error suyo.
  const isOwnApiRequest = req.url.startsWith(environment.apiUrl);

  // Aplicamos withCredentials: false por defecto (CORS best practices)
  let clonedRequest = req.clone({
    withCredentials: false
  });

  // Solo añadimos el token si existe, no está caducado, es una petición a
  // nuestra propia API y NO es una petición de autenticación
  if (isOwnApiRequest && token && !authService.isTokenExpired(token) && !req.url.includes('/api/auth/')) {
    clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  } else if (isOwnApiRequest && token && authService.isTokenExpired(token)) {
    authService.logout();
  }

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!isOwnApiRequest) {
        // Error de un servicio externo (p.ej. Google Geolocation sin API key
        // configurada, o un asset que no cargó): se propaga tal cual, sin
        // tocar la sesión de FidelyFood.
        return throwError(() => error);
      }

      // ✅ [NETWORK ERROR] / [CORS]
      if (error.status === 0) {
        console.error(`[NETWORK ERROR / CORS] Fallo al conectar con ${req.url}`);
        console.error('Detalle:', error.message);
      }

      if (error.status === 401) {
        console.error(`[AUTH ERROR] 401 detectado en ${req.url}`);

        if (req.url.includes('/api/auth/login')) {
           return throwError(() => error);
        }

        // Un 401 solo significa "sesión inválida" si el token que teníamos
        // realmente ha caducado o ya no existe. Un endpoint que rechaza este
        // rol por permisos (p.ej. /api/recompensas solo para ROLE_USER
        // llamado con un token de restaurante) es un 401 de alcance, no de
        // sesión — no debe cerrar una sesión que sigue siendo válida.
        const currentToken = localStorage.getItem('token');
        if (!currentToken || authService.isTokenExpired(currentToken)) {
          authService.logout();
        }
      }

      if (error.status === 403) {
        console.error(`[AUTH ERROR] 403 detectado en ${req.url}`);
        const role = authService.getRoleSync();
        if (role === 'ROLE_ADMIN') router.navigate(['/admin/dashboard']);
        else if (role === 'ROLE_RESTAURANT') router.navigate(['/r/dashboard']);
        else if (role === 'ROLE_USER') router.navigate(['/u/home']);
        else router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );

};
