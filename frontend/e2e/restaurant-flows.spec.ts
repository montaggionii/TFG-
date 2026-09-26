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

  // FID-013 — Flujo completo del panel de restaurante contra el
  // backend/frontend real: dashboard -> escanear (solo navegación,
  // sin leer un QR real) -> crear promo -> aparece en Mis Ofertas ->
  // ajustes -> guardar dirección -> vuelve al dashboard. Cubre el pedido
  // de la rutina nocturna de probar el flujo de restaurante de punta a
  // punta, no solo que cada pantalla cargue de forma aislada.
  test('flujo completo: dashboard -> crear promo -> mis ofertas -> ajustes -> guardar dirección', async ({ page, request, context }) => {
    await context.grantPermissions(['camera']);
    await loginAndGoto(page, request, '/r/dashboard');
    await expect(page.locator('.dashboard-scroll-container')).toBeVisible({ timeout: 10000 });

    // Navegar a Escanear QR desde el dashboard (solo comprobar que navega).
    await page.locator('.action-card.scan').click();
    await expect(page).toHaveURL(/\/r\/scanner/, { timeout: 10000 });
    await expect(page.locator('app-qr-scanner-ui')).toBeVisible({ timeout: 10000 });

    // Volver al dashboard y crear una promo real desde el acceso rápido.
    await page.goto('/r/dashboard');
    await expect(page.locator('.dashboard-scroll-container')).toBeVisible({ timeout: 10000 });
    await page.locator('.action-card.promo').click();

    const uniqueTitle = `E2E Promo ${Date.now()}`;
    await expect(page.locator('ion-input[formcontrolname="titulo"] input')).toBeVisible({ timeout: 10000 });
    await page.locator('ion-input[formcontrolname="titulo"] input').fill(uniqueTitle);
    await page.locator('ion-textarea[formcontrolname="descripcion"] textarea').fill('Promoción creada por el test E2E de flujo completo');
    await page.locator('ion-input[formcontrolname="puntosNecesarios"] input').fill('60');
    await page.locator('ion-button[type="submit"]').click();
    await expect(page.locator('ion-toast')).toContainText('creada', { timeout: 10000 });

    // Mis Ofertas debe mostrar la promo recién creada, con sus puntos.
    await page.goto('/r/promociones');
    await expect(page.locator('ion-title')).toHaveText('Mis Promociones', { timeout: 10000 });
    const promoCard = page.locator('.promo-card-pro', { hasText: uniqueTitle });
    await expect(promoCard).toBeVisible({ timeout: 10000 });
    await expect(promoCard.locator('.puntos-badge')).toContainText('60 PTS');

    // Ajustes: comprobar que guardar una nueva dirección persiste de verdad
    // (recarga completa de la página, no solo el estado local).
    await page.goto('/r/settings');
    await expect(page.locator('ion-input[formcontrolname="direccion"] input')).toBeVisible({ timeout: 10000 });
    const nuevaDireccion = `Calle Test E2E ${Date.now()}`;
    await page.locator('ion-input[formcontrolname="direccion"] input').fill(nuevaDireccion);
    await page.locator('ion-input[formcontrolname="codigoPostal"] input').fill('46021');
    await page.locator('button, ion-button', { hasText: /guardar todos los cambios/i }).click();
    await expect(page.locator('ion-toast')).toContainText('actualizados', { timeout: 10000 });

    await page.reload();
    await expect(page.locator('ion-input[formcontrolname="direccion"] input')).toHaveValue(nuevaDireccion, { timeout: 10000 });
    await expect(page.locator('ion-input[formcontrolname="codigoPostal"] input')).toHaveValue('46021');

    // Volver al dashboard cierra el ciclo del flujo.
    await page.goto('/r/dashboard');
    await expect(page.locator('.dashboard-scroll-container')).toBeVisible({ timeout: 10000 });
  });
});
