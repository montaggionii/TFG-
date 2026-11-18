package progresa.springboot_tfg.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Envío de SMS con Twilio (API REST, sin SDK) y modo desarrollo.
 *
 * app.sms.provider:
 *  - "twilio": envía de verdad con TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
 *    TWILIO_FROM_NUMBER.
 *  - vacío (sin proveedor): no se envía ningún SMS real; el código solo se
 *    registra en el log del servidor. Para probar el flujo completo sin
 *    coste en local, hay que además activar explícitamente
 *    app.sms.dev-expose-code=true (nunca en producción): solo entonces el
 *    código vuelve en claro en la respuesta HTTP como devCodigo.
 *
 * Que falte el proveedor NUNCA debe, por sí solo, hacer que el código viaje
 * en la respuesta: si Twilio no está configurado en producción (por ejemplo,
 * porque nadie ha pagado todavía la cuenta), cualquiera podría entrar como
 * cualquier usuario llamando a POST /api/auth/otp/send y leyendo el código
 * de la propia respuesta — exactamente el mismo tipo de "valor por defecto
 * inseguro cuando falta la configuración" ya corregido en AuthController
 * (contraseña de admin, AGT-008/FID-anterior).
 */
@Service
public class SmsSender {

    private static final Logger log = LoggerFactory.getLogger(SmsSender.class);
    private static final String TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json";

    @Value("${app.sms.provider:}")
    private String provider;

    @Value("${app.sms.dev-expose-code:false}")
    private boolean devExposeCode;

    @Value("${twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${twilio.from-number:}")
    private String twilioFromNumber;

    private final RestClient restClient = RestClient.create();

    /**
     * Envía el código por SMS. Devuelve true solo cuando es seguro que el
     * llamador exponga el código en la respuesta (sin proveedor configurado
     * Y app.sms.dev-expose-code=true, activado a propósito en local).
     */
    public boolean enviar(String telefono, String mensaje) {
        if (!"twilio".equalsIgnoreCase(provider)) {
            log.info("[SMS-DEV] Proveedor de SMS no configurado. Código para {}: {}", telefono, mensaje);
            return devExposeCode;
        }
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("To", telefono);
            form.add("From", twilioFromNumber);
            form.add("Body", mensaje);

            String url = String.format(TWILIO_URL, twilioAccountSid);
            String response = restClient.post()
                    .uri(url)
                    .headers(h -> h.setBasicAuth(twilioAccountSid, twilioAuthToken))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            log.info("[SMS] Enviado a {} (respuesta Twilio: {} chars)", telefono, response == null ? 0 : response.length());
            return false;
        } catch (Exception e) {
            log.error("[SMS] Twilio rechazó el envío a {}: {}", telefono, e.getMessage());
            throw new IllegalStateException("No se pudo enviar el SMS. Revisa las credenciales de Twilio.");
        }
    }

    public boolean modoDesarrollo() {
        return !"twilio".equalsIgnoreCase(provider);
    }
}
