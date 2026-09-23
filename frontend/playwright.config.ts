import { defineConfig } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Carga APP_SEED_RESTAURANT_PASSWORD del .env real del proyecto (nunca
// hardcodeada, nunca commiteada) sin añadir una dependencia nueva solo
// para esto.
function loadRootEnvVar(name: string): void {
  const envPath = path.join(__dirname, '..', '.env');
  if (!existsSync(envPath) || process.env[name]) return;
  const match = readFileSync(envPath, 'utf-8').match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (match) process.env[name] = match[1].trim();
}
loadRootEnvVar('APP_SEED_RESTAURANT_PASSWORD');

// Apunta al backend/frontend de desarrollo ya en marcha (localhost:8100 /
// localhost:8081) — no levanta servidores propios para no chocar con los
// que el usuario ya tenga corriendo.
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
});
