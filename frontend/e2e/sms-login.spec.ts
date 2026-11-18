import { test, expect } from '@playwright/test';

// AGT (login SMS) — el cliente entra con su teléfono y un código de 6
// dígitos, sin contraseña. Contra backend/frontend de desarrollo ya en
// marcha. En desarrollo el backend devuelve el código en devCodigo y la
// UI lo muestra en el aviso "Modo desarrollo"; con Twilio configurado el
// código solo llega por SMS y este test se omite.

test('login CLIENTE por SMS redirige a /u/home', async ({ page }) => {
  const telefono = '+347005550' + Math.floor(100 + Math.random() * 899);

  await page.goto('/login');

  // Paso 1: abrir el flujo sin contraseña
  await page.getByRole('button', { name: /código al móvil/i }).click();
  await expect(page.getByRole('heading', { name: 'Entra con tu móvil' })).toBeVisible();

  // Paso 2: pedir el código
  await page.getByLabel('Número de teléfono').fill(telefono);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByRole('heading', { name: 'Revisa tu móvil' })).toBeVisible({ timeout: 10000 });

  // Paso 3: el código de desarrollo se muestra en la UI; con Twilio real no
  const notaDev = page.locator('.sms-dev-note');
  const hayNotaDev = await notaDev.isVisible().catch(() => false);
  test.skip(!hayNotaDev, 'Proveedor de SMS real configurado: el código no aparece en la UI.');

  const codigo = (await notaDev.textContent())?.match(/\d{6}/)?.[0];
  test.skip(!codigo, 'No se pudo extraer el código de desarrollo.');

  // Paso 4: verificar y entrar
  await page.getByLabel('Código SMS').fill(codigo!);
  await page.getByLabel('Nombre').fill('Cliente E2E SMS');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/\/u\/home/, { timeout: 15000 });
});
