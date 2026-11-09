import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { tokenInterceptor } from './token.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('tokenInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj('AuthService', ['isTokenExpired', 'logout', 'getRoleSync']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('añade el header Authorization en una peticion propia con un token valido', () => {
    localStorage.setItem('token', 'real-token');
    authService.isTokenExpired.and.returnValue(false);

    httpClient.get(`${environment.apiUrl}/api/restaurantes/1`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/restaurantes/1`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer real-token');
    expect(req.request.withCredentials).toBe(false);
    req.flush({});
  });

  it('nunca añade el token a /api/auth/** (login/registro), aunque haya uno guardado', () => {
    localStorage.setItem('token', 'real-token');
    authService.isTokenExpired.and.returnValue(false);

    httpClient.post(`${environment.apiUrl}/api/auth/login`, {}).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('nunca añade el token ni toca la sesion en una peticion a un dominio externo (Google Maps, etc.)', () => {
    localStorage.setItem('token', 'real-token');
    authService.isTokenExpired.and.returnValue(true);

    httpClient.get('https://maps.googleapis.com/maps/api/geocode/json').subscribe({ error: () => {} });

    const req = httpMock.expectOne('https://maps.googleapis.com/maps/api/geocode/json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush('error', { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('con el token propio ya caducado: no añade el header y cierra la sesion de forma preventiva', () => {
    localStorage.setItem('token', 'expired-token');
    authService.isTokenExpired.and.returnValue(true);

    httpClient.get(`${environment.apiUrl}/api/restaurantes/1`).subscribe({ error: () => {} });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/restaurantes/1`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(authService.logout).toHaveBeenCalled();
    req.flush({});
  });

  it('un 401 en /api/auth/login (credenciales incorrectas) se propaga tal cual, sin cerrar ninguna sesion', (done) => {
    httpClient.post(`${environment.apiUrl}/api/auth/login`, {}).subscribe({
      next: () => fail('no deberia emitir un valor'),
      error: (err) => {
        expect(err.status).toBe(401);
        expect(authService.logout).not.toHaveBeenCalled();
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/login`);
    req.flush('Credenciales incorrectas', { status: 401, statusText: 'Unauthorized' });
  });

  it('un 401 de alcance (token propio aun valido, endpoint que no es para este rol) no cierra la sesion', (done) => {
    localStorage.setItem('token', 'still-valid-token');
    authService.isTokenExpired.and.returnValue(false);

    httpClient.get(`${environment.apiUrl}/api/recompensas`).subscribe({
      next: () => fail('no deberia emitir un valor'),
      error: (err) => {
        expect(err.status).toBe(401);
        expect(authService.logout).not.toHaveBeenCalled();
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/recompensas`);
    req.flush('Forbidden role', { status: 401, statusText: 'Unauthorized' });
  });

  it('un 401 de sesion real (el token ya no existe cuando llega la respuesta) cierra la sesion', (done) => {
    localStorage.setItem('token', 'will-be-removed');
    authService.isTokenExpired.and.returnValue(false);

    httpClient.get(`${environment.apiUrl}/api/puntos/mio`).subscribe({
      error: () => {
        expect(authService.logout).toHaveBeenCalled();
        done();
      }
    });

    localStorage.removeItem('token');
    const req = httpMock.expectOne(`${environment.apiUrl}/api/puntos/mio`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('un 403 redirige segun el rol actual (restaurante entrando a un endpoint de admin)', () => {
    authService.getRoleSync.and.returnValue('ROLE_RESTAURANT');

    httpClient.get(`${environment.apiUrl}/api/admin/businesses`).subscribe({ error: () => {} });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/admin/businesses`);
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(router.navigate).toHaveBeenCalledWith(['/r/dashboard']);
  });
});
