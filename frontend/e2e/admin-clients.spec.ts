import { test, expect } from '@playwright/test';
import { apiLoginAdmin, authenticateAs } from './helpers/auth';

// AGT-003 ya señaló, al cerrarse (2026-10-08), que el panel admin solo
// tenía cubierto el listado de negocios (admin-businesses.spec.ts) y que
// un cuarto spec de admin (clientes o reservas) quedaba fuera de esa
// sesión. Este spec cubre ese hueco: el listado de clientes
// (/admin/clients) y la apertura del detalle de un cliente real, la
// única pantalla del panel admin que además muta datos (ajuste manual de
// puntos, ya cubierto por AdminControllerPointsTest en el backend, pero
// nunca ejercitado end-to-end a través de la UI real).

const ADMIN_EMAIL = 'admin@fidelyfood.local';

test.describe('Admin — listado y detalle de clientes', () => {
  test('carga el listado real de clientes y abre el detalle de uno', async ({ page, request }) => {
    const adminPassword = process.env['FIDELYFOOD_ADMIN_PASSWORD'];
    test.skip(!adminPassword, 'FIDELYFOOD_ADMIN_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginAdmin(request, ADMIN_EMAIL, adminPassword!);
    await authenticateAs(page, session, '/admin/clients');

    await expect(page).toHaveURL(/\/admin\/clients/);
    await expect(page.locator('ion-title')).toHaveText('Clientes');

    // El contador de "Total" debe terminar de cargar con clientes reales
    // (hay cuentas de cliente ya sembradas/registradas, igual que
    // admin-businesses.spec.ts hace con los negocios).
    const totalMetric = page.locator('.client-metrics article', { hasText: 'Total' }).locator('strong');
    await expect(totalMetric).toBeVisible({ timeout: 10000 });
    await expect(async () => {
      expect(Number(await totalMetric.textContent())).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });

    // Antes de abrir cualquier detalle, ningún panel lateral muestra ya
    // datos de un cliente.
    await expect(page.locator('.client-detail')).toHaveCount(0);

    // Abrir el primer cliente real de la lista carga su detalle (GET
    // /api/admin/clients/{id}) sin dejar el spinner de carga colgado.
    const firstRow = page.locator('.table-wrap.desktop-list tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    const detailPanel = page.locator('.client-detail');
    await expect(detailPanel).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.detail-loading')).toHaveCount(0, { timeout: 10000 });

    // El resumen (pestaña por defecto) muestra el saldo de puntos real
    // del cliente seleccionado, no el placeholder de "selecciona un
    // cliente".
    await expect(page.locator('.summary-grid')).toBeVisible();
    await expect(page.locator('.summary-grid article', { hasText: 'Puntos totales' })).toBeVisible();
  });
});
