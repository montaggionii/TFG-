import { APIRequestContext, Page } from '@playwright/test';

const API_URL = 'http://localhost:8081/api/auth';

export interface Session {
  token: string;
  role: string;
  nombre: string;
  userId: number;
}

// Login real contra el backend (JWT auténtico), sin pasar por la UI —
// se usa para dejar al navegador ya autenticado antes de probar una
// pantalla concreta, igual que haría cualquier test de integración.
export async function apiLoginClient(request: APIRequestContext, email: string, password: string): Promise<Session> {
  const res = await request.post(`${API_URL}/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`Login de cliente falló (${res.status()}): ${await res.text()}`);
  const body = await res.json();
  return { token: body.token, role: 'ROLE_USER', nombre: body.nombre || 'Cliente E2E', userId: body.id };
}

// Inyecta la sesión real en localStorage con TODAS las claves que deja el
// login real (ver AuthService.handleAuthResponse) — en particular `userId`,
// sin la cual GlobalStateService.loadInitialState() no puede reconstruir el
// estado del usuario y la app se queda cargando indefinidamente (esto se
// detectó al escribir este test: sin `userId` el spinner de home nunca
// desaparece, no porque la app falle, sino porque el fixture de login
// simulado estaba incompleto frente al que genera el login real).
export async function authenticateAs(page: Page, session: Session, path: string) {
  await page.goto('/login');
  await page.evaluate(({ token, role, nombre, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role);
    localStorage.setItem('nombre', nombre);
    localStorage.setItem('userId', String(userId));
  }, session);
  await page.goto(path);
}
