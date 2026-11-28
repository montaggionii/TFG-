import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { GlobalStateService } from '../state/global-state.service';
import { environment } from '../../../environments/environment';

// AGT-xxx — AuthService no tenía ningún test propio a pesar de ser el
// único sitio del frontend que decide qué rol tiene la sesión (decodifica
// el JWT real), qué queda en localStorage y a dónde se redirige tras el
// login — justo la lógica que authGuard/roleGuard/tokenInterceptor (ya
// cubiertos en AGT-030) asumen correcta sin probarla ellos mismos.

function base64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.firma-no-verificada`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;
  let globalState: jasmine.SpyObj<GlobalStateService>;

  beforeEach(() => {
    localStorage.clear();
    globalState = jasmine.createSpyObj('GlobalStateService', ['setState']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GlobalStateService, useValue: globalState }
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('isTokenExpired', () => {
    it('sin token devuelve true', () => {
      expect(service.isTokenExpired(null)).toBe(true);
    });

    it('con un token sin fecha de caducidad devuelve true', () => {
      const token = makeJwt({ sub: 'cliente@test.com' });
      expect(service.isTokenExpired(token)).toBe(true);
    });

    it('con un token mal formado devuelve true en vez de lanzar', () => {
      expect(service.isTokenExpired('esto-no-es-un-jwt')).toBe(true);
    });

    it('con un token caducado devuelve true', () => {
      const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
      expect(service.isTokenExpired(token)).toBe(true);
    });

    it('con un token vigente devuelve false', () => {
      const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
      expect(service.isTokenExpired(token)).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('sin token guardado devuelve false', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('con un token vigente guardado devuelve true', () => {
      localStorage.setItem('token', makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      expect(service.isAuthenticated()).toBe(true);
    });

    it('con un token caducado guardado devuelve false', () => {
      localStorage.setItem('token', makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 }));
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('loginUsuario — decodificación de rol y persistencia de sesión', () => {
    function login(credentials: any = { email: 'a@test.com', password: 'x' }) {
      service.loginUsuario(credentials).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
      return req;
    }

    it('con roles como array en el JWT usa el primero, no el rol por defecto', () => {
      const token = makeJwt({ roles: ['ROLE_USER'] });
      login().flush({ token, nombre: 'Cliente Test', id: 7 });

      expect(localStorage.getItem('role')).toBe('ROLE_USER');
      expect(router.navigate).toHaveBeenCalledWith(['/u/home']);
    });

    it('con role como string suelto en el JWT lo usa tal cual', () => {
      const token = makeJwt({ role: 'ROLE_ADMIN' });
      login().flush({ token, nombre: 'Admin' });

      expect(localStorage.getItem('role')).toBe('ROLE_ADMIN');
      expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    });

    it('sin ningún claim de rol en el JWT usa el rol por defecto del método de login', () => {
      const token = makeJwt({ sub: 'cliente@test.com' });
      login().flush({ token, nombre: 'Cliente Test', id: 7 });

      expect(localStorage.getItem('role')).toBe('ROLE_USER');
      expect(router.navigate).toHaveBeenCalledWith(['/u/home']);
    });

    it('guarda el token, id y foto reales en localStorage y limpia la sesión anterior', () => {
      localStorage.setItem('token', 'token-de-otra-sesion');
      localStorage.setItem('userId', '999');
      const token = makeJwt({ roles: ['ROLE_USER'] });

      login().flush({ token, nombre: 'Cliente Test', id: 7, fotoPerfil: '/uploads/foto.jpg' });

      expect(localStorage.getItem('token')).toBe(token);
      expect(localStorage.getItem('userId')).toBe('7');
      expect(localStorage.getItem('userPhoto')).toBe('/uploads/foto.jpg');
    });

    it('sincroniza el GlobalStateService con el usuario real tras el login', () => {
      const token = makeJwt({ roles: ['ROLE_USER'] });
      login().flush({ token, nombre: 'Cliente Test', id: 7, puntos: 120 });

      expect(globalState.setState).toHaveBeenCalledWith(jasmine.objectContaining({
        id: 7,
        nombre: 'Cliente Test',
        rol: 'ROLE_USER',
        puntos: 120
      }));
    });

    it('una respuesta sin token no toca localStorage ni redirige', () => {
      service.loginUsuario({ email: 'a@test.com', password: 'x' }).subscribe({ error: () => {} });
      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
      req.flush({ message: 'Credenciales incorrectas' }, { status: 401, statusText: 'Unauthorized' });

      expect(localStorage.getItem('token')).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('limpia localStorage, el estado global y redirige a /login', () => {
      localStorage.setItem('token', 'real-token');
      localStorage.setItem('role', 'ROLE_USER');
      localStorage.setItem('currentUser', '{"id":1}');

      service.logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('role')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(globalState.setState).toHaveBeenCalledWith(null);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      expect(service.getToken()).toBeNull();
    });
  });
});
