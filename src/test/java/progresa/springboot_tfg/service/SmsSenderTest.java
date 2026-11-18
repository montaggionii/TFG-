package progresa.springboot_tfg.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Vulnerabilidad real encontrada en esta sesión (rutina en la nube,
 * 2026-11-18): sin APP_SMS_PROVIDER=twilio configurado, SmsSender.enviar()
 * devolvía siempre true ("modo desarrollo"), y OtpAuthService.enviarCodigo()
 * usa ese true para decidir si incluye el código OTP en claro en la propia
 * respuesta HTTP (devCodigo) de POST /api/auth/otp/send — un endpoint
 * público (permitAll en SecurityConfig). render.yaml no define ninguna
 * variable de Twilio, así que en producción (tal y como está desplegado
 * hoy) cualquiera podía autenticarse como cualquier número de teléfono (o
 * crear una cuenta nueva) con solo leer el código de su propia respuesta:
 * mismo tipo de "valor por defecto inseguro cuando falta la configuración"
 * ya corregido en AuthController para la contraseña de admin.
 *
 * Fix: una nueva propiedad explícita, app.sms.dev-expose-code (por defecto
 * false), separa "no hay proveedor de SMS real" de "es seguro devolver el
 * código en la respuesta" — solo con las dos condiciones a la vez
 * (sin proveedor Y la nueva propiedad puesta a true a propósito en local)
 * se expone el código.
 */
class SmsSenderTest {

    private SmsSender sender() {
        return new SmsSender();
    }

    @Test
    void sinProveedorYSinLaPropiedadDeDevNuncaExponeElCodigo() {
        SmsSender sender = sender();
        ReflectionTestUtils.setField(sender, "provider", "");
        ReflectionTestUtils.setField(sender, "devExposeCode", false);

        boolean exponeCodigoEnLaRespuesta = sender.enviar("+34600111222", "Tu código es 123456");

        assertFalse(exponeCodigoEnLaRespuesta,
                "Sin proveedor de SMS configurado (como en producción, sin Twilio) el código nunca debe "
                        + "devolverse en la respuesta HTTP salvo que se active app.sms.dev-expose-code a propósito");
    }

    @Test
    void sinProveedorConLaPropiedadDeDevActivadaExponeElCodigoParaProbarEnLocal() {
        SmsSender sender = sender();
        ReflectionTestUtils.setField(sender, "provider", "");
        ReflectionTestUtils.setField(sender, "devExposeCode", true);

        boolean exponeCodigoEnLaRespuesta = sender.enviar("+34600111222", "Tu código es 123456");

        assertTrue(exponeCodigoEnLaRespuesta);
    }

    @Test
    void sinNingunaPropiedadConfiguradaElValorPorDefectoEsSeguro() {
        // Simula el estado real de producción: ninguna de las dos variables
        // (APP_SMS_PROVIDER, APP_SMS_DEV_EXPOSE_CODE) está definida en
        // render.yaml, así que Spring usaría los valores por defecto de los
        // propios @Value ("" y false) — nunca inyectados aquí a propósito.
        SmsSender sender = sender();

        boolean exponeCodigoEnLaRespuesta = sender.enviar("+34600111222", "Tu código es 123456");

        assertFalse(exponeCodigoEnLaRespuesta);
    }
}
