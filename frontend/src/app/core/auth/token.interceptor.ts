import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Interceptor de Tokens Blindado - Ingeniería Senior
 */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  // Sincronización del Token: Obtenemos el valor más fresco del localStorage
  const token = localStorage.getItem('token');

  // Aplicamos withCredentials: false por defecto (CORS best practices)
  let clonedRequest = req.clone({
    withCredentials: false
  });

  // Solo añadimos el token si existe y NO es una petición de autenticación
  if (token && !req.url.includes('/api/auth/')) {
    clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
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
      }
      return throwError(() => error);
    })
  );

};
