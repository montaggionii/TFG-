import { test, expect } from '@playwright/test';
import { apiLoginAdmin, authenticateAs } from './helpers/auth';

// AGT-003 — El panel admin solo tenía login cubierto por la suite E2E
// (login.spec.ts); ninguna de sus pantallas de gestión tenía spec propio.
// Cubre el listado de negocios (/admin/businesses), la pantalla de admin
// más usada según AGENT_TASKS.md (gestión de las fotos/estado de los
// restaurantes sembrados).

const ADMIN_EMAIL = 'admin@fidelyfood.local';

test.describe('Admin — listado de negocios', () => {
  test('carga el listado real de negocios y sus métricas', async ({ page, request }) => {
    const adminPassword = process.env['FIDELYFOOD_ADMIN_PASSWORD'];
    test.skip(!adminPassword, 'FIDELYFOOD_ADMIN_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginAdmin(request, ADMIN_EMAIL, adminPassword!);
    await authenticateAs(page, session, '/admin/businesses');

    await expect(page).toHaveURL(/\/admin\/businesses/);
    await expect(page.locator('ion-title')).toHaveText('Negocios');
    // La lista real (sembrada con restaurantes de verdad, ver
    // AGENT_TASKS.md AGT-005) debe terminar de cargar: el contador de
    // "Total" deja de estar en 0 y pasa a reflejar negocios reales.
    const totalMetric = page.locator('.admin-metrics article', { hasText: 'Total' }).locator('strong');
    await expect(totalMetric).toBeVisible({ timeout: 10000 });
    await expect(async () => {
      expect(Number(await totalMetric.textContent())).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });
});
