import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, tap, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import { GlobalStateService } from '../state/global-state.service';

export interface AuthState {
  token: string | null;
  rol: string | null;
  nombre: string | null;
  id?: number;
  foto?: string | null;
}


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private globalState = inject(GlobalStateService);
  private get apiUrl(): string {
    return `${environment.apiUrl}/api/auth`;
  }


  // 1. INICIALIZACIÓN INMEDIATA (INGENIERÍA SENIOR)
  private getInitialState(): AuthState {
    const token = localStorage.getItem('token');
    if (!token) return { token: null, rol: null, nombre: null };
    
    return {
      token: token,
      rol: localStorage.getItem('role'),
      nombre: localStorage.getItem('nombre'),
      id: localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : undefined,
      foto: localStorage.getItem('userPhoto')
    };

  }

  private authStateSubject = new BehaviorSubject<AuthState>(this.getInitialState());

  public authState$ = this.authStateSubject.asObservable();

  constructor() {
    // Sincronización inicial del GlobalStateService con el valor atómico
    this.syncGlobalState(this.authStateSubject.getValue());
  }

  private clearSessionStorage() {
    ['token', 'role', 'nombre', 'userId', 'userPhoto', 'currentUser'].forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // --- MÉTODOS DE AUTENTICACIÓN ---

  loginUsuario(credentials: any): Observable<any> {
    const fullUrl = `${this.apiUrl}/login`;
    const baseDetected = fullUrl.replace('/api/auth/login', '');
    
    console.log(`[BACKEND URL] Detectada: ${baseDetected}`);
    console.log(`[LOGIN REQUEST] Intentando login usuario: ${credentials.email}`);
    console.log(`[LOGIN REQUEST] URL completa: ${fullUrl}`);


    return this.http.post<any>(fullUrl, credentials).pipe(
      tap({
        next: (res) => {
          console.log(`[LOGIN RESPONSE] Éxito para ${credentials.email}`);
          if (res.token) console.log(`[TOKEN JWT] Recibido: ${res.token.substring(0, 15)}...`);
          this.handleAuthResponse(res, 'ROLE_USER');
        },
        error: (err) => {
          console.error(`[AUTH ERROR] Fallo en login usuario:`, err.status, err.statusText);
          if (err.status === 0) console.error('[NETWORK ERROR] El backend no responde. Verifica CORS o IP.');
        }
      })
    );
  }

  loginRestaurante(credentials: any): Observable<any> {
    const fullUrl = `${this.apiUrl}/login-restaurante`;
    const baseDetected = fullUrl.replace('/api/auth/login-restaurante', '');
    
    console.log(`[BACKEND URL] Detectada: ${baseDetected}`);
    console.log(`[LOGIN REQUEST] Intentando login restaurante: ${credentials.email}`);
    console.log(`[LOGIN REQUEST] URL completa: ${fullUrl}`);


    return this.http.post<any>(fullUrl, credentials).pipe(
      tap({
        next: (res) => {
          console.log(`[LOGIN RESPONSE] Éxito para Restaurante ${credentials.email}`);
          if (res.token) console.log(`[TOKEN JWT] Recibido: ${res.token.substring(0, 15)}...`);
          this.handleAuthResponse(res, 'ROLE_RESTAURANT');
        },
        error: (err) => {
          console.error(`[AUTH ERROR] Fallo en login restaurante:`, err.status, err.statusText);
          if (err.status === 0) console.error('[NETWORK ERROR] El backend no responde. Verifica CORS o IP.');
        }
      })
    );
  }

  loginAdmin(credentials: any): Observable<any> {
    const fullUrl = `${this.apiUrl}/login-admin`;
    
    console.log(`[LOGIN REQUEST] Intentando login admin: ${credentials.email}`);

    return this.http.post<any>(fullUrl, credentials).pipe(
      tap({
        next: (res) => {
          console.log(`[LOGIN RESPONSE] Éxito para admin ${credentials.email}`);
          this.handleAuthResponse(res, 'ROLE_ADMIN');
        },
        error: (err) => {
          console.error(`[AUTH ERROR] Fallo en login admin:`, err.status, err.statusText);
        }
      })
    );
  }

  registerUsuario(data: any): Observable<any> {
    const fullUrl = `${this.apiUrl}/register`;
    console.log('DEBUG URL (Register):', fullUrl);
    return this.http.post<any>(fullUrl, data);
  }

  registerRestaurante(data: any): Observable<any> {
    const fullUrl = `${this.apiUrl}/register-restaurante`;
    console.log('DEBUG URL (Register Rest):', fullUrl);
    return this.http.post<any>(fullUrl, data);
  }

  private handleAuthResponse(res: any, fallbackRole: string) {
    if (res && res.token) {
      console.log('[AuthService] Procesando respuesta de login. Limpiando sesión previa...');
      
      // Limpieza atómica antes de escribir el nuevo usuario
      this.clearSessionStorage();
      this.globalState.setState(null);

      let role = fallbackRole;
      try {
        const decoded: any = jwtDecode(res.token);
        const rawRole = decoded.roles || decoded.role || (decoded.authorities && decoded.authorities[0]?.authority);
        if (rawRole) {
          role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
        }
      } catch (e) {
        console.warn('[AuthService] Error decodificando JWT.');
      }

      const nombre = res.nombre || res.usuario?.nombre || res.restaurante?.nombre || 'Usuario';
      const id = res.id || res.usuario?.id || res.restaurante?.id;
      const foto = res.fotoPerfil || res.foto || res.usuario?.fotoPerfil || res.restaurante?.foto || null;

      // 5. PERSISTENCIA ANTES QUE EMISIÓN (ORDEN VITAL)
      localStorage.setItem('token', res.token);
      localStorage.setItem('role', role);
      localStorage.setItem('nombre', nombre);
      if (id) localStorage.setItem('userId', id.toString());
      if (foto) localStorage.setItem('userPhoto', foto);

      const newState: AuthState = { token: res.token, rol: role, nombre, id, foto };


      // Emitimos el nuevo estado DESPUÉS de asegurar el localStorage
      this.authStateSubject.next(newState);
      this.syncGlobalState(newState);

      this.redirectByRole(role);
    }
  }

  private syncGlobalState(state: AuthState) {
    if (!state.id) {
      this.globalState.setState(null);
      return;
    }
    
    this.globalState.setState({
      id: state.id,
      nombre: state.nombre || '',
      email: '',
      rol: state.rol || '',
      token: state.token || '',
      fotoPerfil: state.foto || undefined
    });

  }

  private redirectByRole(role: string) {
    const normalized = role.toUpperCase();
    const target = normalized.includes('ADMIN')
      ? '/admin/dashboard'
      : normalized.includes('RESTAURANT')
        ? '/r/dashboard'
        : '/u/home';
    this.router.navigate([target]);
  }

  // --- HELPERS ---

  public getToken(): string | null {
    return this.authStateSubject.getValue().token || localStorage.getItem('token');
  }

  public getRoleSync(): string | null {
    return this.authStateSubject.getValue().rol || localStorage.getItem('role');
  }

  public isTokenExpired(token: string | null = this.getToken()): boolean {
    if (!token) return true;
    try {
      const decoded: any = jwtDecode(token);
      if (!decoded.exp) return true;
      return decoded.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  public isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired(token);
  }

  public logout() {
    // 3. RASTREO DE REDIRECCIÓN FUGITIVA
    console.trace('Cierre de sesión invocado desde:');
    
    this.clearSessionStorage();
    this.authStateSubject.next({ token: null, rol: null, nombre: null });
    this.globalState.setState(null);
    this.router.navigate(['/login']);
  }
}
