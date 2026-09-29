package progresa.springboot_tfg.security;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Test unitario de la ventana deslizante de {@link LoginRateLimiter} (sin Spring, sin base de
 * datos real). Usa el constructor de paquete con reloj inyectable para poder simular el paso del
 * tiempo sin esperar los 10 minutos reales de la ventana — ese constructor solo existe para tests,
 * el bean de producción sigue usando el constructor público sin argumentos (Instant.now() real).
 *
 * Cubre la lógica de negocio que hasta ahora solo se probaba con el test E2E de integración
 * `frontend/e2e/security-login-rate-limit.spec.ts` (requiere backend + red real).
 */
class LoginRateLimiterTest {

    private static final String KEY = "127.0.0.1|cliente@example.com";
    private static final String OTHER_KEY = "127.0.0.1|otro@example.com";

    private LoginRateLimiter withClock(AtomicReference<Instant> now) {
        try {
            Constructor<LoginRateLimiter> ctor = LoginRateLimiter.class.getDeclaredConstructor(java.util.function.Supplier.class);
            ctor.setAccessible(true);
            return ctor.newInstance((java.util.function.Supplier<Instant>) now::get);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void claveNuevaNoEstaBloqueadaPorDefecto() {
        LoginRateLimiter limiter = new LoginRateLimiter();

        assertFalse(limiter.isBlocked(KEY));
    }

    @Test
    void siguePermitiendoHastaSieteIntentosFallidos() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        for (int i = 0; i < 7; i++) {
            limiter.recordFailure(KEY);
        }

        assertFalse(limiter.isBlocked(KEY), "7 fallos no deberían bloquear (límite es 8)");
    }

    @Test
    void bloqueaAlOctavoIntentoFallido() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        for (int i = 0; i < 8; i++) {
            limiter.recordFailure(KEY);
        }

        assertTrue(limiter.isBlocked(KEY), "8 fallos deben bloquear la clave (IP+email)");
    }

    @Test
    void unLoginCorrectoReseteaElContadorYDesbloquea() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        for (int i = 0; i < 8; i++) {
            limiter.recordFailure(KEY);
        }
        assertTrue(limiter.isBlocked(KEY));

        limiter.recordSuccess(KEY);

        assertFalse(limiter.isBlocked(KEY), "un login correcto debe limpiar los fallos previos");
    }

    @Test
    void clavesDistintasSonIndependientes() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        for (int i = 0; i < 8; i++) {
            limiter.recordFailure(KEY);
        }

        assertTrue(limiter.isBlocked(KEY));
        assertFalse(limiter.isBlocked(OTHER_KEY), "bloquear una cuenta no debe afectar a otra desde la misma IP");
    }

    @Test
    void laVentanaDeDiezMinutosEsDeslizante_fallosAntiguosNoCuentan() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        // 8 fallos en el instante inicial → bloqueado.
        for (int i = 0; i < 8; i++) {
            limiter.recordFailure(KEY);
        }
        assertTrue(limiter.isBlocked(KEY));

        // Avanza el reloj 10 minutos y 1 segundo: la ventana deslizante debe purgar esos 8 fallos.
        now.set(now.get().plusSeconds(601));

        assertFalse(limiter.isBlocked(KEY), "los fallos fuera de la ventana de 10 minutos no deben contar");
    }

    @Test
    void unSoloFalloReciente_dentroDeLaVentana_noBloquea() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-01-01T00:00:00Z"));
        LoginRateLimiter limiter = withClock(now);

        // 7 fallos antiguos que expiran, más 1 fallo reciente: en total nunca coexisten 8 dentro
        // de la ventana, así que no debe bloquear.
        for (int i = 0; i < 7; i++) {
            limiter.recordFailure(KEY);
        }
        now.set(now.get().plusSeconds(601));
        limiter.recordFailure(KEY);

        assertFalse(limiter.isBlocked(KEY));
    }
}
