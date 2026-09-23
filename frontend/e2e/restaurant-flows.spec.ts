import { test, expect } from '@playwright/test';
import { apiLoginRestaurant, authenticateAs } from './helpers/auth';

// FID-004 — Tests E2E de restaurante contra el backend/frontend de
// desarrollo real. Usa la cuenta sembrada real "Venezuela Food"
// (contraseña desde APP_SEED_RESTAURANT_PASSWORD, nunca hardcodeada).
//
// El escáner QR necesita cámara real: en un entorno E2E headless no se
// simula una lectura de cámara falsa (sería un dato inventado). Este
// test se limita a verificar que la pantalla del escáner carga y monta
// el componente real de cámara — no finge un escaneo.

const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

async function loginAndGoto(page: any, request: any, path: string) {
  const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
  test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');
  const session = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);
  await authenticateAs(page, session, path);
}

test.describe('Restaurante', () => {
  test('dashboard carga el Centro de Mando', async ({ page, request }) => {
    await loginAndGoto(page, request, '/r/dashboard');
    await expect(page).toHaveURL(/\/r\/dashboard/);
    await expect(page.locator('ion-title')).toHaveText('Centro de Mando', { timeout: 10000 });
    // La pantalla debe salir del estado de carga/error real, no quedarse
    // en el loader indefinidamente.
    await expect(page.locator('.dashboard-scroll-container')).toBeVisible({ timeout: 10000 });
  });

  test('promociones carga el listado real', async ({ page, request }) => {
    await loginAndGoto(page, request, '/r/promociones');
    await expect(page).toHaveURL(/\/r\/promociones/);
    await expect(page.locator('ion-title')).toHaveText('Mis Promociones', { timeout: 10000 });
  });

  test('scanner monta el componente real de cámara', async ({ page, request, context }) => {
    await context.grantPermissions(['camera']);
    await loginAndGoto(page, request, '/r/scanner');
    await expect(page).toHaveURL(/\/r\/scanner/);
    await expect(page.locator('ion-title')).toHaveText('Escanear Cliente', { timeout: 10000 });
    await expect(page.locator('app-qr-scanner-ui')).toBeVisible({ timeout: 10000 });
  });
});
