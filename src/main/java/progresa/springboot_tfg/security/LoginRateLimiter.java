package progresa.springboot_tfg.security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ConcurrentMap;

/**
 * Limitador de intentos de login en memoria, por clave (IP + email).
 * Deliberadamente simple para el tamaño de este proyecto (una sola
 * instancia, sin Redis): solo cuenta intentos FALLIDOS, así que un login
 * legítimo repetido (tests E2E, un usuario reintentando tras corregir una
 * errata) nunca cuenta contra el límite.
 *
 * Limitación conocida: al ir por IP+email en vez de solo por IP, no frena
 * a un atacante que reparte los intentos entre muchas cuentas distintas
 * desde la misma IP — sí frena eficazmente el caso más común (probar
 * muchas contraseñas contra una cuenta conocida).
 */
@Component
public class LoginRateLimiter {

    private static final int MAX_FAILURES = 8;
    private static final Duration WINDOW = Duration.ofMinutes(10);

    private final ConcurrentMap<String, Deque<Instant>> failuresByKey = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        return prune(key).size() >= MAX_FAILURES;
    }

    public void recordFailure(String key) {
        Deque<Instant> attempts = prune(key);
        attempts.addLast(Instant.now());
        failuresByKey.put(key, attempts);
    }

    public void recordSuccess(String key) {
        failuresByKey.remove(key);
    }

    private Deque<Instant> prune(String key) {
        Deque<Instant> attempts = failuresByKey.getOrDefault(key, new ConcurrentLinkedDeque<>());
        Instant cutoff = Instant.now().minus(WINDOW);
        while (!attempts.isEmpty() && attempts.peekFirst() != null && attempts.peekFirst().isBefore(cutoff)) {
            attempts.pollFirst();
        }
        return attempts;
    }
}
