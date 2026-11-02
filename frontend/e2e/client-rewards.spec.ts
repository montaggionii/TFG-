import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, apiLoginRestaurant, authenticateAs } from './helpers/auth';

// AGT-003 señalaba este hueco explícitamente al cerrarse (2026-10-08): el
// catálogo de recompensas del cliente (/u/recompensas) seguía sin ningún
// spec propio, pese a que `canje-promocion.spec.ts` ya prueba el canje en
// sí vía API — nunca que la pantalla real agrupe por restaurante, muestre
// el saldo de puntos o el coste de cada recompensa.

const API_URL = `${process.env['E2E_API_URL'] || 'http://localhost:8081'}/api`;
const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Cliente — catálogo de recompensas (/u/recompensas)', () => {
  test('agrupa por restaurante y muestra el coste real de una recompensa creada', async ({ page, request }) => {
    const seedPassword = process.env['APP_SEED_RESTAURANT_PASSWORD'];
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const restaurantSession = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);

    // Puntos poco probables de colisionar con una promoción ya sembrada,
    // para poder localizar sin ambigüedad la tarjeta de esta recompensa.
    const puntosRecompensa = 8123;
    const crear = await request.post(`${API_URL}/promociones`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
      data: {
        titulo: 'Recompensa E2E catálogo',
        descripcion: 'Promoción de prueba creada por client-rewards.spec.ts',
        puntosOtorgados: puntosRecompensa,
        tipo: 'CANJEAR',
      },
    });
    expect(crear.ok()).toBeTruthy();
    const promo = await crear.json();

    try {
      const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
      const clientSession = await apiLoginClient(request, creds.email, creds.password);
      await authenticateAs(page, clientSession, '/u/recompensas');

      await expect(page).toHaveURL(/\/u\/recompensas/);
      await expect(page.locator('ion-title')).toHaveText('Catálogo de premios');
      // Sale del spinner de carga real (no se queda esperando getPromociones indefinidamente).
      await expect(page.locator('ion-spinner')).toHaveCount(0, { timeout: 10000 });
      await expect(page.locator('.marketplace-container')).toBeVisible();

      const grupoRestaurante = page.locator('.restaurant-group').filter({ hasText: restaurantSession.nombre });
      await expect(grupoRestaurante).toBeVisible();

      const tarjetaRecompensa = grupoRestaurante.locator('.reward-item-pro').filter({ hasText: 'Recompensa E2E catálogo' });
      await expect(tarjetaRecompensa).toBeVisible();
      await expect(tarjetaRecompensa.locator('.pts-pill')).toContainText(String(puntosRecompensa));
    } finally {
      await request.delete(`${API_URL}/promociones/${promo.id}`, {
        headers: { Authorization: `Bearer ${restaurantSession.token}` },
      });
    }
  });
});
