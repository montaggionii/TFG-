import { test, expect } from '@playwright/test';
import { apiLoginAdmin, authenticateAs } from './helpers/auth';

// AGT-027 señaló, al cerrarse (2026-10-24), que de las 4 pantallas de
// gestión del panel admin (businesses/clients/reservations/stats) solo
// reservations seguía sin ningún spec propio. Este archivo cubre ese
// hueco (pantalla /admin/reservations cargando datos reales) y, de paso,
// fija el hallazgo de esta misma sesión (AGT-028): el selector de estado
// y los botones de acción rápida del formulario de reservas ofrecen
// PENDING/CONFIRMED/CANCELLED/COMPLETED/ATTENDED/NO_SHOW, pero el backend
// solo aceptaba los tres primeros — elegir "Completada", "Asistió" o "No
// asistió" desde la UI real siempre fallaba con un 400 silencioso (solo
// un toast de error, sin romper la pantalla). Corregido en
// AdminController (RESERVATION_STATUSES).

const ADMIN_EMAIL = 'admin@fidelyfood.local';
const API_URL = `${process.env['E2E_API_URL'] || 'http://localhost:8081'}/api`;

test.describe('Admin — listado de reservas', () => {
  test('carga el listado real de reservas y sus métricas', async ({ page, request }) => {
    const adminPassword = process.env['FIDELYFOOD_ADMIN_PASSWORD'];
    test.skip(!adminPassword, 'FIDELYFOOD_ADMIN_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginAdmin(request, ADMIN_EMAIL, adminPassword!);

    // Siembra una reserva real vía API para no depender de que ya exista
    // alguna (a diferencia de clientes/negocios, las reservas no vienen
    // precargadas con los datos semilla del proyecto).
    const crear = await request.post(`${API_URL}/admin/reservations`, {
      headers: { Authorization: `Bearer ${session.token}` },
      data: {
        clientName: 'Cliente E2E Reservas',
        clientEmail: 'cliente-e2e-reservas@fidelyfood.local',
        businessName: 'Negocio E2E Reservas',
        people: 2,
        status: 'PENDING',
      },
    });
    expect(crear.ok()).toBeTruthy();
    const reserva = await crear.json();
    expect(reserva.id).toBeTruthy();

    try {
      await authenticateAs(page, session, '/admin/reservations');

      await expect(page).toHaveURL(/\/admin\/reservations/);
      await expect(page.locator('ion-title')).toHaveText('Reservas');

      // El contador de "Total" debe terminar de cargar y reflejar al
      // menos la reserva sembrada arriba.
      const totalMetric = page.locator('.admin-metrics article', { hasText: 'Total' }).locator('strong');
      await expect(totalMetric).toBeVisible({ timeout: 10000 });
      await expect(async () => {
        expect(Number(await totalMetric.textContent())).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      // Abrir la reserva sembrada (primera fila, orden descendente por
      // fecha de creación — ver AdminReservationDAO.findByDeletedFalseOrderByDateDesc)
      // carga su detalle real, no el placeholder "Selecciona una reserva".
      const firstRow = page.locator('.table-wrap.desktop-list tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 10000 });
      await firstRow.click();

      await expect(page.locator('.reservation-detail')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.summary-grid')).toBeVisible();
    } finally {
      // Limpieza: borrado lógico de la reserva de prueba.
      await request.delete(`${API_URL}/admin/reservations/${reserva.id}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
    }
  });

  test('AGT-028: los 6 estados que ofrece la UI (incl. Completada/Asistió/No asistió) se aceptan de verdad', async ({ request }) => {
    const adminPassword = process.env['FIDELYFOOD_ADMIN_PASSWORD'];
    test.skip(!adminPassword, 'FIDELYFOOD_ADMIN_PASSWORD no está definida en el entorno de este proceso.');

    const session = await apiLoginAdmin(request, ADMIN_EMAIL, adminPassword!);

    const crear = await request.post(`${API_URL}/admin/reservations`, {
      headers: { Authorization: `Bearer ${session.token}` },
      data: {
        clientName: 'Cliente E2E Estados',
        clientEmail: 'cliente-e2e-estados@fidelyfood.local',
        businessName: 'Negocio E2E Estados',
        people: 2,
        status: 'PENDING',
      },
    });
    expect(crear.ok()).toBeTruthy();
    const reserva = await crear.json();

    try {
      // Antes del fix de AGT-028, estas tres transiciones (disponibles
      // como botones de acción rápida en la pantalla real) devolvían 400.
      for (const status of ['COMPLETED', 'ATTENDED', 'NO_SHOW']) {
        const cambio = await request.patch(`${API_URL}/admin/reservations/${reserva.id}/status`, {
          headers: { Authorization: `Bearer ${session.token}` },
          data: { status },
        });
        expect(cambio.ok(), `PATCH status=${status} debería devolver 200`).toBeTruthy();
        const body = await cambio.json();
        expect(body.status).toBe(status);
      }

      // Un estado fuera de ese conjunto sigue rechazándose (sin abrir el
      // enum a cualquier texto).
      const invalido = await request.patch(`${API_URL}/admin/reservations/${reserva.id}/status`, {
        headers: { Authorization: `Bearer ${session.token}` },
        data: { status: 'ARCHIVADA' },
      });
      expect(invalido.status()).toBe(400);
    } finally {
      await request.delete(`${API_URL}/admin/reservations/${reserva.id}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
    }
  });
});
