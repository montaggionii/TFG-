import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, apiLoginRestaurant, authenticateAs } from './helpers/auth';

// AGT-003 — Ficha de restaurante del cliente (/u/restaurante/:id) no tenía
// ningún spec todavía. Usa la cuenta sembrada real "Venezuela Food" solo
// para obtener su id real vía login (mismo truco que
// security-restaurant-stats.spec.ts) — no hace falta autenticarse como
// restaurante para ver su propia ficha pública, que es lo que de verdad
// prueba este spec como cliente.

const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Cliente — detalle de restaurante', () => {
  test('carga el restaurante real y su sección de promociones', async ({ page, request }) => {
    const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const restaurantSession = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);

    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const clientSession = await apiLoginClient(request, creds.email, creds.password);
    await authenticateAs(page, clientSession, `/u/restaurante/${restaurantSession.userId}`);

    await expect(page).toHaveURL(new RegExp(`/u/restaurante/${restaurantSession.userId}`));
    // El título muestra el fallback genérico mientras carga; una vez
    // cargado el restaurante real debe mostrar su nombre de verdad.
    await expect(page.locator('ion-title')).toHaveText(restaurantSession.nombre, { timeout: 10000 });
    await expect(page.locator('.hero-section')).toBeVisible({ timeout: 10000 });
    // La sección de promociones siempre se renderiza (con tarjetas reales
    // o con el estado vacío real), nunca se queda en el loader/error.
    await expect(page.locator('.promotions-section')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.loading-container')).toHaveCount(0);
    await expect(page.locator('.error-container')).toHaveCount(0);
  });
});
