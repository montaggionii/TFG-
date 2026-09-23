import { test, expect } from '@playwright/test';

// FID-001 — Regresión real (no simulada) del rate-limiting de login.
// Verificado manualmente antes de escribir esto: 8 intentos fallidos con
// la misma cuenta devuelven 401 (además, ya no distingue "email no
// existe" de "contraseña incorrecta" — esa distinción por código HTTP
// permitía enumerar cuentas registradas, corregido en el mismo cambio);
// el intento 9 devuelve 429. Una cuenta DISTINTA desde la misma IP no se
// ve afectada (la clave del límite es IP+email, no solo IP), así que
// esto no interfiere con el resto de la suite E2E.

const API_URL = `${process.env.E2E_API_URL || 'http://localhost:8081'}/api/auth/login`;

test('bloquea con 429 tras demasiados intentos fallidos contra la misma cuenta', async ({ request }) => {
  const dummyEmail = `ratelimit-e2e-${Date.now()}@fidelyfood.local`;

  let lastStatus = 0;
  for (let i = 0; i < 9; i++) {
    const res = await request.post(API_URL, {
      data: { email: dummyEmail, password: 'incorrecta' },
    });
    lastStatus = res.status();
    if (lastStatus === 429) break;
  }

  expect(lastStatus).toBe(429);
});

test('no bloquea intentos fallidos contra una cuenta distinta desde la misma IP', async ({ request }) => {
  // Cuenta que el test anterior ya "gastó" no debería afectar a esta.
  const res = await request.post(API_URL, {
    data: { email: `otra-cuenta-${Date.now()}@fidelyfood.local`, password: 'incorrecta' },
  });
  // Debe ser un 401 normal (credenciales inválidas), nunca un 429.
  expect(res.status()).toBe(401);
});
