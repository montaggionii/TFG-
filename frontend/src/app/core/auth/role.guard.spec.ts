import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';

describe('roleGuard', () => {
  let router: Router;
  let authService: jasmine.SpyObj<AuthService>;
  const fakeRoute = {} as ActivatedRouteSnapshot;

  function run(allowed: string | string[], url: string): boolean {
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => roleGuard(allowed)(fakeRoute, state)) as boolean;
  }

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['isAuthenticated', 'getRoleSync']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('permite el acceso cuando el rol actual coincide exactamente con el rol pedido', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRoleSync.and.returnValue('ROLE_USER');

    expect(run('ROLE_USER', '/u/home')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('permite el acceso cuando el rol actual esta dentro de una lista de roles permitidos', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRoleSync.and.returnValue('ROLE_ADMIN');

    expect(run(['ROLE_ADMIN', 'ROLE_RESTAURANT'], '/r/dashboard')).toBe(true);
  });

  it('bloquea y redirige al dashboard de restaurante cuando un restaurante intenta entrar a una ruta de admin', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRoleSync.and.returnValue('ROLE_RESTAURANT');

    expect(run('ROLE_ADMIN', '/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/r/dashboard']);
  });

  it('bloquea y redirige a /u/home cuando un cliente intenta entrar a una ruta de admin', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRoleSync.and.returnValue('ROLE_USER');

    expect(run('ROLE_ADMIN', '/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/u/home']);
  });

  it('sin sesion en una ruta de admin: bloquea y redirige a /admin/login', () => {
    authService.isAuthenticated.and.returnValue(false);
    authService.getRoleSync.and.returnValue(null);

    expect(run('ROLE_ADMIN', '/admin/dashboard')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/login']);
  });

  it('sin sesion en una ruta normal: bloquea y redirige a /login', () => {
    authService.isAuthenticated.and.returnValue(false);
    authService.getRoleSync.and.returnValue(null);

    expect(run('ROLE_USER', '/u/home')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('autenticado pero sin rol reconocible: bloquea (nunca concede acceso solo por estar autenticado)', () => {
    authService.isAuthenticated.and.returnValue(true);
    authService.getRoleSync.and.returnValue(null);

    expect(run('ROLE_USER', '/u/home')).toBe(false);
  });
});
