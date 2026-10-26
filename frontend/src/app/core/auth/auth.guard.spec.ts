import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let router: Router;
  let authService: jasmine.SpyObj<AuthService>;
  const fakeRoute = {} as ActivatedRouteSnapshot;

  function runGuard(url: string): boolean {
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(fakeRoute, state)) as boolean;
  }

  beforeEach(() => {
    localStorage.clear();
    authService = jasmine.createSpyObj('AuthService', ['isTokenExpired', 'logout']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => localStorage.clear());

  it('sin token en una ruta normal: bloquea y redirige a /login', () => {
    expect(runGuard('/u/home')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('sin token en una ruta de admin: bloquea y redirige a /admin/login, no a /login', () => {
    expect(runGuard('/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
  });

  it('token caducado: cierra la sesion (logout) y bloquea, sin usar el redirect generico del guard', () => {
    localStorage.setItem('token', 'expired-token');
    authService.isTokenExpired.and.returnValue(true);

    expect(runGuard('/u/home')).toBe(false);
    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('token valido con rol RESTAURANT en una ruta /r/: permite el acceso', () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('role', 'ROLE_RESTAURANT');
    authService.isTokenExpired.and.returnValue(false);

    expect(runGuard('/r/dashboard')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('token valido con rol USER intentando entrar a una ruta /r/: bloquea y redirige a /login', () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('role', 'ROLE_USER');
    authService.isTokenExpired.and.returnValue(false);

    expect(runGuard('/r/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('token valido con rol RESTAURANT intentando entrar a /admin: bloquea y redirige a su propio dashboard, no al de admin', () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('role', 'ROLE_RESTAURANT');
    authService.isTokenExpired.and.returnValue(false);

    expect(runGuard('/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/r/dashboard']);
  });

  it('token valido con rol USER intentando entrar a /admin: bloquea y redirige a /u/home', () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('role', 'ROLE_USER');
    authService.isTokenExpired.and.returnValue(false);

    expect(runGuard('/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/u/home']);
  });

  it('token valido con rol ADMIN en /admin: permite el acceso', () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('role', 'ROLE_ADMIN');
    authService.isTokenExpired.and.returnValue(false);

    expect(runGuard('/admin/dashboard')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
