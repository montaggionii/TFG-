package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.exception.BadRequestException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Códigos de un solo uso (OTP) para entrar con el número de teléfono:
 * 6 dígitos, caducan a los 5 minutos, 3 intentos y un minuto de espera
 * entre reenvíos. Solo se guarda el hash del código, nunca el código.
 */
@Service
public class OtpService {

    /** TTL del código. */
    static final Duration TTL = Duration.ofMinutes(5);
    /** Espera mínima entre dos envíos al mismo teléfono. */
    static final Duration COOLDOWN = Duration.ofSeconds(60);
    /** Intentos de verificación por código. */
    static final int MAX_INTENTOS = 3;

    private record Entrada(String hash, Instant expira, Instant proximoEnvio, int[] intentos) {}

    private final ConcurrentHashMap<String, Entrada> codigos = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final SmsSender smsSender;

    public OtpService(SmsSender smsSender) {
        this.smsSender = smsSender;
    }

    /**
     * Genera y envía el código. Devuelve el código en claro SOLO en modo
     * desarrollo (sin proveedor de SMS configurado); en producción devuelve
     * null y el código viaja únicamente por SMS.
     */
    public String enviar(String telefono) {
        Instant ahora = Instant.now();
        Entrada previa = codigos.get(telefono);
        if (previa != null && previa.proximoEnvio().isAfter(ahora)) {
            long segundos = Duration.between(ahora, previa.proximoEnvio()).toSeconds();
            throw new BadRequestException("Espera " + segundos + "s antes de pedir otro código");
        }

        String codigo = String.format("%06d", random.nextInt(1_000_000));
        Entrada entrada = new Entrada(
                hash(codigo),
                ahora.plus(TTL),
                ahora.plus(COOLDOWN),
                new int[]{MAX_INTENTOS});
        codigos.put(telefono, entrada);

        boolean modoDev = smsSender.enviar(telefono,
                "Tu código FidelyFood es " + codigo + ". Caduca en 5 minutos.");
        return modoDev ? codigo : null;
    }

    /**
     * Verifica el código. true = válido; false = incorrecto (consume un
     * intento). Lanza IllegalStateException si caducó o se agotaron los
     * intentos.
     */
    public boolean verificar(String telefono, String codigo) {
        Entrada entrada = codigos.get(telefono);
        if (entrada == null || entrada.expira().isBefore(Instant.now())) {
            codigos.remove(telefono);
            throw new BadRequestException("El código ha caducado. Pide uno nuevo.");
        }
        if (entrada.intentos()[0] <= 0) {
            codigos.remove(telefono);
            throw new BadRequestException("Demasiados intentos. Pide un código nuevo.");
        }

        boolean valido = hash(codigo).equals(entrada.hash());
        if (valido) {
            codigos.remove(telefono);
        } else {
            entrada.intentos()[0]--;
        }
        return valido;
    }

    /** Pruebas: fija el reloj interno de caducidad. */
    void caducar(String telefono) {
        Entrada entrada = codigos.get(telefono);
        if (entrada != null) {
            codigos.put(telefono, new Entrada(entrada.hash(), Instant.MIN, Instant.MIN, entrada.intentos()));
        }
    }

    private static String hash(String codigo) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] h = digest.digest((codigo + "::fidelyfood-otp").getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(h);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
