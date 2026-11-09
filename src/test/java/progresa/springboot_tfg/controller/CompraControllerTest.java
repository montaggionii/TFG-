package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dto.RegistrarCompraDTO;
import progresa.springboot_tfg.service.CompraService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * CompraController no tenía ningún test propio: comprueba ROLE_RESTAURANT
 * directamente en el controlador (SecurityUtils.requireRole), igual patrón
 * que PuntosController (AGT-020)/CanjeController (AGT-021)/RecompensaController
 * (AGT-033). También fija que el email del restaurante que otorga los puntos
 * siempre viene de Authentication, nunca del body — CompraServiceTest ya
 * documentaba que no hay vulnerabilidad aquí, pero nada a nivel de
 * controlador lo comprobaba hasta ahora.
 */
@ExtendWith(MockitoExtension.class)
class CompraControllerTest {

    @Mock
    private CompraService compraService;

    private CompraController controller;

    @BeforeEach
    void setUp() {
        controller = new CompraController(compraService);
    }

    private Authentication authAs(String email, String role) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority(role)));
    }

    private RegistrarCompraDTO dto(long usuarioId, double importe) {
        RegistrarCompraDTO dto = new RegistrarCompraDTO();
        dto.setUsuarioId(usuarioId);
        dto.setImporte(importe);
        return dto;
    }

    @Test
    void registrarCompraConRolDistintoDeRestauranteLanzaAccessDeniedSinTocarElServicio() {
        RegistrarCompraDTO body = dto(1L, 25.50);

        assertThrows(AccessDeniedException.class,
                () -> controller.registrarCompra(body, authAs("cliente@test.com", "ROLE_USER")));

        verifyNoInteractions(compraService);
    }

    @Test
    void registrarCompraConRolAdminTambienLanzaAccessDenied() {
        RegistrarCompraDTO body = dto(1L, 25.50);

        assertThrows(AccessDeniedException.class,
                () -> controller.registrarCompra(body, authAs("admin@test.com", "ROLE_ADMIN")));

        verifyNoInteractions(compraService);
    }

    @Test
    void registrarCompraConRolRestauranteDelegaEnElServicioConElEmailAutenticado() {
        RegistrarCompraDTO body = dto(1L, 25.50);

        ResponseEntity<?> res = controller.registrarCompra(body, authAs("mexicanfood@fidelyfood.local", "ROLE_RESTAURANT"));

        assertEquals(200, res.getStatusCode().value());
        verify(compraService).registrarCompra(1L, 25.50, "mexicanfood@fidelyfood.local");
    }

    @Test
    void registrarCompraUsaSiempreElEmailAutenticadoNuncaUnoDelBody() {
        RegistrarCompraDTO body = dto(7L, 10.0);

        controller.registrarCompra(body, authAs("venezuelafood@fidelyfood.local", "ROLE_RESTAURANT"));

        verify(compraService).registrarCompra(7L, 10.0, "venezuelafood@fidelyfood.local");
    }
}
