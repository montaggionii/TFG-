import { request } from '@playwright/test';
import { writeFileSync } from 'fs';
import path from 'path';

// Crea una cuenta de cliente E2E desechable en cada ejecución (email/
// password aleatorios, nunca reutilizados ni commiteados) contra el
// backend real de desarrollo, vía la propia API pública de registro.
// El fichero generado es efímero y está en .gitignore.
export default async function globalSetup() {
  const suffix = Date.now();
  const email = `e2e-client-${suffix}@fidelyfood.local`;
  const password = `E2eTest!${suffix}`;
  const nombre = 'E2E Cliente Autogenerado';

  const apiUrl = 'http://localhost:8081/api/auth/register';
  const ctx = await request.newContext();
  try {
    const res = await ctx.post(apiUrl, {
      data: { nombre, email, password },
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`No se pudo crear la cuenta E2E de cliente (status ${res.status()}): ${body}`);
    }
  } finally {
    await ctx.dispose();
  }

  const outPath = path.join(__dirname, '.e2e-client.json');
  writeFileSync(outPath, JSON.stringify({ email, password, nombre }), 'utf-8');
}
