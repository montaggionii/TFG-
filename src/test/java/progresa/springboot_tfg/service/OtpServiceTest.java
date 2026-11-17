package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import progresa.springboot_tfg.exception.BadRequestException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OtpServiceTest {

    private OtpService service;
    private SmsSender smsSender;

    @BeforeEach
    void setUp() {
        smsSender = mock(SmsSender.class);
        when(smsSender.enviar(anyString(), anyString())).thenReturn(true);
        service = new OtpService(smsSender);
    }

    @Test
    void enviarDevuelveCodigoEnModoDesarrolloYVerificaCorrecto() {
        String codigo = service.enviar("+34600111222");

        // Modo desarrollo: el código vuelve en claro para pruebas
        assertTrue(codigo != null && codigo.matches("\\d{6}"));
        assertTrue(service.verificar("+34600111222", codigo));
    }

    @Test
    void codigoIncorrectoConsumeUnIntentoYTresErroresBloquean() {
        String codigo = service.enviar("+34600111222");

        assertFalse(service.verificar("+34600111222", "000000".equals(codigo) ? "111111" : "000000"));
        assertFalse(service.verificar("+34600111222", "111111"));
        assertFalse(service.verificar("+34600111222", "222222"));

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.verificar("+34600111222", "333333"));
        assertTrue(ex.getMessage().contains("Demasiados intentos"));
    }

    @Test
    void codigoCaducadoExigeUnoNuevo() {
        service.enviar("+34600111222");
        service.caducar("+34600111222");

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.verificar("+34600111222", "123456"));
        assertTrue(ex.getMessage().contains("caducado"));
    }

    @Test
    void reenvioEnMenosDeUnMinutoLanzaCooldown() {
        service.enviar("+34600111222");
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> service.enviar("+34600111222"));
        assertTrue(ex.getMessage().contains("Espera"));
    }

    @Test
    void telefonosDistintosTienenCodigosIndependientes() {
        String codigoA = service.enviar("+34600111222");
        String codigoB = service.enviar("+34600999888");

        // El código del teléfono B no vale para el teléfono A
        assertFalse(service.verificar("+34600111222", codigoB));
        // ... y el de A sí vale para A
        assertTrue(service.verificar("+34600111222", codigoA));
        // Un código ya verificado se consume: no vale una segunda vez
        assertThrows(BadRequestException.class,
                () -> service.verificar("+34600111222", codigoA));
    }
}
