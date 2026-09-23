import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

// FID-002 — Tests E2E de login para los 3 roles reales de FidelyFood,
// contra el backend/frontend de desarrollo ya en marcha. Sin datos
// falsos: el cliente se crea de verdad vía la API pública de registro
// (ver global-setup.ts); el restaurante usa una cuenta sembrada real
// (contraseña desde APP_SEED_RESTAURANT_PASSWORD, nunca hardcodeada);
// el admin usa el valor por defecto ya público en AuthController.java.

async function fillLogin(page: import('@playwright/test').Page, email: string, password: string) {
  await page.locator('ion-input[formcontrolname="email"] input').fill(email);
  await page.locator('ion-input[formcontrolname="password"] input').fill(password);
}

test('login ADMIN redirige a /admin/dashboard', async ({ page }) => {
  await page.goto('/admin/login');
  await fillLogin(page, 'admin@fidelyfood.local', 'admin123');
  await page.locator('button[type="submit"], ion-button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
});

test('login RESTAURANTE redirige a /r/dashboard', async ({ page }) => {
  const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
  test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

  await page.goto('/login');
  // El selector de rol por defecto es "Cliente" — hay que cambiar a "Negocio".
  await page.getByRole('button', { name: 'Negocio' }).click();
  await fillLogin(page, 'venezuelafood@gmail.com', seedPassword!);
  await page.locator('ion-button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/r\/dashboard/, { timeout: 10000 });
});

test('login CLIENTE redirige a /u/home', async ({ page }) => {
  const credsPath = path.join(__dirname, '.e2e-client.json');
  const { email, password } = JSON.parse(readFileSync(credsPath, 'utf-8'));

  await page.goto('/login');
  await fillLogin(page, email, password);
  await page.locator('ion-button[type="submit"]').first().click();
  await expect(page).toHaveURL(/\/u\/home/, { timeout: 10000 });
});
