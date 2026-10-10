import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { apiLoginClient, apiLoginRestaurant } from './helpers/auth';

// FID-017 — Regresión de seguridad real (no simulada) para el hallazgo
// encontrado en la auditoría: PromocionController devolvía la entidad
// Promocion sin pasar por un DTO, y esta arrastraba la entidad Restaurante
// completa —incluido el hash bcrypt de la contraseña— en el campo anidado
// "restaurante". Cualquier cuenta autenticada (cliente o restaurante ajeno,
// ambos roles con permiso de GET sobre /api/promociones/**) podía leer el
// hash de cualquier restaurante con al menos una promoción y atacarlo
// offline. Verificado empíricamente antes de corregirlo (un token de
// cliente recién registrado obtenía el hash real de Venezuela Food).
// Corregido con @JsonProperty(access = WRITE_ONLY) en Restaurante.password
// (y en Usuario.password, mismo patrón, defensa en profundidad), que sigue
// permitiendo cambiar la contraseña vía PUT pero nunca la serializa.

const API_URL = `${process.env['E2E_API_URL'] || 'http://localhost:8081'}/api`;
const RESTAURANT_EMAIL = 'venezuelafood@gmail.com';

test.describe('Seguridad — filtrado de contraseña en promociones', () => {
  test('la lista de promociones NO expone el hash de contraseña del restaurante', async ({ request }) => {
    const seedPassword = process.env['APP_SEED_RESTAURANT_PASSWORD'];
    test.skip(!seedPassword, 'APP_SEED_RESTAURANT_PASSWORD no está definida en el entorno de este proceso.');

    const creds = JSON.parse(readFileSync(path.join(__dirname, '.e2e-client.json'), 'utf-8'));
    const clientSession = await apiLoginClient(request, creds.email, creds.password);
    const restaurantSession = await apiLoginRestaurant(request, RESTAURANT_EMAIL, seedPassword!);

    // Crea una promo real y desechable para asegurar que el restaurante
    // aparece en la respuesta de la lista.
    const createRes = await request.post(`${API_URL}/promociones`, {
      headers: { Authorization: `Bearer ${restaurantSession.token}` },
      data: { titulo: 'E2E Promo Password Leak Check', descripcion: 'temporal', puntosOtorgados: 1, tipo: 'GANAR' },
    });
    expect(createRes.ok()).toBeTruthy();
    const promo = await createRes.json();

    try {
      const listRes = await request.get(`${API_URL}/promociones`, {
        headers: { Authorization: `Bearer ${clientSession.token}` },
      });
      expect(listRes.status()).toBe(200);
      const list = await listRes.json();
      const mine = list.find((p: any) => p.id === promo.id);
      expect(mine).toBeTruthy();
      expect(mine.restaurante).not.toHaveProperty('password');

      const byRestaurantRes = await request.get(`${API_URL}/promociones/restaurante/${restaurantSession.userId}`, {
        headers: { Authorization: `Bearer ${clientSession.token}` },
      });
      expect(byRestaurantRes.status()).toBe(200);
      const byRestaurant = await byRestaurantRes.json();
      for (const p of byRestaurant) {
        expect(p.restaurante).not.toHaveProperty('password');
      }
    } finally {
      await request.delete(`${API_URL}/promociones/${promo.id}`, {
        headers: { Authorization: `Bearer ${restaurantSession.token}` },
      });
    }
  });
});
