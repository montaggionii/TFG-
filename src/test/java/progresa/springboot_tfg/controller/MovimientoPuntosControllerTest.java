package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dto.MovimientoPuntosDTO;
import progresa.springboot_tfg.service.MovimientoPuntosService;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-042 — MovimientoPuntosController no tenía ningún test propio. Es el
 * único controlador de negocio (junto a TestController, trivial) que seguía
 * sin cobertura directa tras AGT-017/019/020/021/022/033/035/036/039. A
 * diferencia de esos, no comprueba un rol en el propio controlador (la
 * restricción ROLE_USER vive en SecurityConfig), pero sí tiene el mismo tipo
 * de riesgo que motivó AGT-028 (mass assignment) y AGT-002: nunca debe
 * aceptar un identificador de usuario del cliente, solo el email del JWT.
 */
@ExtendWith(MockitoExtension.class)
class MovimientoPuntosControllerTest {

    @Mock
    private MovimientoPuntosService movimientoPuntosService;

    private MovimientoPuntosController controller;

    @BeforeEach
    void setUp() {
        controller = new MovimientoPuntosController(movimientoPuntosService);
    }

    private Authentication authAs(String email) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void obtenerHistorialDevuelveElHistorialDelServicio() {
        MovimientoPuntosDTO movimiento = new MovimientoPuntosDTO(
                10, "ACUMULACION", "Compra realizada", LocalDateTime.now(), 15.0, "Juan Pérez", null
        );
        when(movimientoPuntosService.obtenerHistorialUsuario("cliente@test.com"))
                .thenReturn(List.of(movimiento));

        ResponseEntity<List<MovimientoPuntosDTO>> res = controller.obtenerHistorial(authAs("cliente@test.com"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, res.getBody().size());
        assertEquals("ACUMULACION", res.getBody().get(0).getTipo());
    }

    @Test
    void obtenerHistorialUsaSiempreElEmailAutenticadoNuncaUnOtroValor() {
        controller.obtenerHistorial(authAs("otro-cliente@test.com"));

        verify(movimientoPuntosService).obtenerHistorialUsuario(eq("otro-cliente@test.com"));
        verify(movimientoPuntosService, never()).obtenerHistorialUsuario(eq("cliente@test.com"));
    }
}
