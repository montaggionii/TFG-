import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, apiLoginRestaurant } from './helpers/auth';

// FID-005 — Regresión de seguridad real (no simulada) para el hallazgo
// encontrado en la auditoría: GET /api/restaurantes/{id}/stats-avanzadas
// y /stats no comprobaban que el solicitante fuera el propio restaurante,
// exponiendo facturación e historial completo a cualquier cuenta
// autenticada (verificado empíricamente antes de corregirlo: un token de
// cliente obtenía 200 OK con datos reales). Corregido reutilizando el
// mismo patrón `requireOwner` que ya protegía el resto de endpoints de
// RestauranteController/UsuarioController.

const API_URL = `${process.env.E2E_API_URL || 'http://localhost:8081'}/api`;
// Venezuela Food — cuenta sembrada real, ver .agent/discoveries.md.
const RESTAURANT_ID = 3;
const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Seguridad — stats de restaurante', () => {
  test('un cliente NO puede ver las stats de un restaurante ajeno', async ({ request }) => {
    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const session = await apiLoginClient(request, creds.email, creds.password);

    const res = await request.get(`${API_URL}/restaurantes/${RESTAURANT_ID}/stats-avanzadas`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(403);
  });

  test('el propio restaurante SÍ puede ver sus stats', async ({ request }) => {
    const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);
    const res = await request.get(`${API_URL}/restaurantes/${RESTAURANT_ID}/stats-avanzadas`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('facturacionTotal');
  });
});
