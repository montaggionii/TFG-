import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, apiLoginRestaurant } from './helpers/auth';

// AGT-002 — El backend no exponía POST /api/canjes: el frontend
// (PromocionService.canjearPromocion) lo llama desde hace tiempo para
// canjear una promoción de tipo CANJEAR, pero no existía ningún
// CanjeController/CanjeService, así que un cliente nunca podía canjear
// puntos por una promoción (solo por una Recompensa, vía
// /api/recompensas/{id}/canjear). Este spec prueba el flujo real contra
// un backend real: gana puntos con una compra, canjea una promoción con
// esos puntos, y comprueba que el saldo baja lo esperado.
//
// Comprueba también la regla de ownership por JWT: el body que manda hoy
// el frontend incluye un `usuarioId`, pero el backend debe ignorarlo por
// completo y usar siempre el email autenticado — nunca sería posible que
// un cliente canjeara puntos "a nombre de" otro usuario.

const API_URL = `${process.env.E2E_API_URL || 'http://localhost:8081'}/api`;
const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Canje de promociones (AGT-002)', () => {
  test('un cliente gana puntos con una compra y canjea una promoción CANJEAR con ellos', async ({ request }) => {
    const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const clientSession = await apiLoginClient(request, creds.email, creds.password);
    const restaurantSession = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);

    const antes = await (await request.get(`${API_URL}/usuarios/${clientSession.userId}`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    })).json();

    // 1. El restaurante registra una compra de 20€ -> 20 puntos para el cliente.
    const compra = await request.post(`${API_URL}/compras`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
      data: { usuarioId: clientSession.userId, importe: 20 },
    });
    expect(compra.ok()).toBeTruthy();

    // 2. El restaurante crea una promoción de tipo CANJEAR que cuesta 15 puntos.
    const crear = await request.post(`${API_URL}/promociones`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
      data: {
        titulo: 'Postre gratis (E2E canje)',
        descripcion: 'Promoción de prueba creada por canje-promocion.spec.ts',
        puntosOtorgados: 15,
        tipo: 'CANJEAR',
      },
    });
    expect(crear.ok()).toBeTruthy();
    const promo = await crear.json();
    expect(promo.id).toBeTruthy();

    // 3. El cliente canjea la promoción. El body manda un usuarioId que NO
    //    es el suyo (el del restaurante) a propósito: si el backend lo
    //    usara en vez del email del JWT, este test lo detectaría porque el
    //    saldo del cliente real no bajaría.
    const canje = await request.post(`${API_URL}/canjes`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
      data: { usuarioId: restaurantSession.userId, promocionId: promo.id },
    });
    expect(canje.ok()).toBeTruthy();

    // 4. El saldo del cliente real bajó exactamente lo que cuesta la promoción.
    const perfil = await request.get(`${API_URL}/usuarios/${clientSession.userId}`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    });
    expect(perfil.ok()).toBeTruthy();
    const body = await perfil.json();
    // Delta, no un valor absoluto: otros specs de esta misma suite pueden
    // compartir la misma cuenta E2E y haber cambiado su saldo antes o
    // después de este test, según el orden/paralelismo de ejecución.
    expect(body.puntos).toBe(antes.puntos + 20 - 15);

    // 5. Limpieza: borrar la promoción de prueba.
    await request.delete(`${API_URL}/promociones/${promo.id}`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
    });
  });

  test('un cliente sin puntos suficientes no puede canjear (400) y no se le descuenta nada', async ({ request }) => {
    const seedPassword = process.env.APP_SEED_RESTAURANT_PASSWORD;
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const clientSession = await apiLoginClient(request, creds.email, creds.password);
    const restaurantSession = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);

    const antes = await (await request.get(`${API_URL}/usuarios/${clientSession.userId}`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    })).json();

    const crear = await request.post(`${API_URL}/promociones`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
      data: {
        titulo: 'Promo carísima (E2E canje)',
        descripcion: 'Promoción de prueba creada por canje-promocion.spec.ts',
        puntosOtorgados: antes.puntos + 1000,
        tipo: 'CANJEAR',
      },
    });
    expect(crear.ok()).toBeTruthy();
    const promo = await crear.json();

    const canje = await request.post(`${API_URL}/canjes`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
      data: { usuarioId: clientSession.userId, promocionId: promo.id },
    });
    expect(canje.status()).toBe(400);

    const despues = await (await request.get(`${API_URL}/usuarios/${clientSession.userId}`, {
      headers: { Authorization: `Bearer ${clientSession.token}` },
    })).json();
    expect(despues.puntos).toBe(antes.puntos);

    await request.delete(`${API_URL}/promociones/${promo.id}`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
    });
  });
});
