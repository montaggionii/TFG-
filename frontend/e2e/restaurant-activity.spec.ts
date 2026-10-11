import { test, expect } from '@playwright/test';
import { apiLoginRestaurant, authenticateAs } from './helpers/auth';

// AGT-003 — "Historial de Actividad" del restaurante (/r/actividad) no
// tenía ningún spec, pese a ser una de las pantallas de negocio
// principales del panel de restaurante (facturación, puntos entregados y
// canjeados, historial de movimientos).

const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Restaurante — historial de actividad', () => {
  test('carga las estadísticas reales y sale del skeleton de carga', async ({ page, request }) => {
    const seedPassword = process.env['APP_SEED_RESTAURANT_PASSWORD'];
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);
    await authenticateAs(page, session, '/r/actividad');

    await expect(page).toHaveURL(/\/r\/actividad/);
    await expect(page.locator('ion-title')).toHaveText('Historial de Actividad');
    // La pantalla debe salir del skeleton de carga real (no quedarse
    // indefinidamente esperando getAdvancedStats).
    await expect(page.locator('.skeleton-wrapper')).toHaveCount(0, { timeout: 10000 });
  });
});
