import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, authenticateAs } from './helpers/auth';

// FID-003 — Tests E2E de cliente contra el backend/frontend de desarrollo
// real. Reutiliza la cuenta E2E creada por global-setup.ts (FID-002) y
// obtiene un JWT real vía la API de login (sin repetir el formulario de
// login en cada test — más rápido y no menos real: es el mismo token que
// generaría el login por UI).

test.describe('Cliente', () => {
  test('home carga y muestra la tarjeta de usuario', async ({ page, request }) => {
    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const session = await apiLoginClient(request, creds.email, creds.password);
    await authenticateAs(page, session, '/u/home');

    await expect(page).toHaveURL(/\/u\/home/);
    await expect(page.locator('app-user-card')).toBeVisible({ timeout: 10000 });
  });

  test('mapa solicita geolocalización real y la usa (mockeada)', async ({ page, request, context }) => {
    // Valencia — coordenadas de prueba, mockeadas a nivel de navegador vía
    // la API estándar de Playwright, no una simulación propia del test.
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 39.4699, longitude: -0.3763 });

    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const session = await apiLoginClient(request, creds.email, creds.password);
    await authenticateAs(page, session, '/u/mapa');

    await expect(page).toHaveURL(/\/u\/mapa/);
    // Con permiso concedido y coordenadas reales, el estado no debe quedarse
    // en "denegado" ni en "error" — debe llegar a activo o, como mucho,
    // seguir pidiendo la posición.
    await expect(page.locator('.geo-status--warning')).toHaveCount(0, { timeout: 10000 });
  });

  test('historial carga el balance de puntos', async ({ page, request }) => {
    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const session = await apiLoginClient(request, creds.email, creds.password);
    await authenticateAs(page, session, '/u/historial');

    await expect(page).toHaveURL(/\/u\/historial/);
    // Cuenta E2E recién creada: no tendrá movimientos, así que la carga
    // correcta termina en el estado vacío real de la página (no en el
    // ion-refresher, que siempre tiene su propio ion-spinner en el DOM
    // independientemente del estado de carga).
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 10000 });
  });

  test('perfil carga y logout devuelve a /login', async ({ page, request }) => {
    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const session = await apiLoginClient(request, creds.email, creds.password);
    await authenticateAs(page, session, '/u/perfil');

    await expect(page).toHaveURL(/\/u\/perfil/);
    await page.locator('.btn-destructive').click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
