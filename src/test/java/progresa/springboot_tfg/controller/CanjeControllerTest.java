package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import progresa.springboot_tfg.dto.CanjePromocionDTO;
import progresa.springboot_tfg.entity.Canje;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.service.PromocionService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-021 — CanjeController (POST /api/canjes) no tenía ningún test propio.
 * Solo el servicio (PromocionService.canjearPromocion, cubierto en AGT-002)
 * tenía tests; nada fijaba que el controlador identifica siempre al usuario
 * por el JWT (Authentication), nunca por el usuarioId del body — la propia
 * protección de seguridad que documenta CanjePromocionDTO ("ignorado por el
 * backend"). Un cambio futuro que, por accidente, empezara a leer
 * dto.getUsuarioId() reabriría la posibilidad de canjear a nombre de otro
 * usuario sin que nada lo detectara salvo una auditoría manual.
 */
@ExtendWith(MockitoExtension.class)
class CanjeControllerTest {

    @Mock
    private PromocionService promocionService;

    private CanjeController controller;

    @BeforeEach
    void setUp() {
        controller = new CanjeController(promocionService);
    }

    private Authentication authComo(String email) {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn(email);
        return authentication;
    }

    private CanjePromocionDTO dto(Long usuarioIdDelBody, Long promocionId) {
        CanjePromocionDTO dto = new CanjePromocionDTO();
        dto.setUsuarioId(usuarioIdDelBody);
        dto.setPromocionId(promocionId);
        return dto;
    }

    @Test
    void canjearUsaSiempreElEmailDelJwtNuncaElUsuarioIdDelBody() {
        Authentication authentication = authComo("cliente@test.com");
        when(promocionService.canjearPromocion(7L, "cliente@test.com")).thenReturn(mock(Canje.class));

        ResponseEntity<?> res = controller.canjear(dto(999L, 7L), authentication);

        assertEquals(200, res.getStatusCode().value());
        verify(promocionService).canjearPromocion(eq(7L), eq("cliente@test.com"));
    }

    @Test
    void canjearPropagaBadRequestSiLaPromocionNoEsDeTipoCanjearOSinSaldo() {
        Authentication authentication = authComo("cliente@test.com");
        when(promocionService.canjearPromocion(anyLong(), anyString()))
                .thenThrow(new BadRequestException("Puntos insuficientes para canjear esta promoción"));

        assertThrows(BadRequestException.class, () -> controller.canjear(dto(1L, 7L), authentication));
    }

    @Test
    void canjearPropagaNotFoundSiLaPromocionNoExiste() {
        Authentication authentication = authComo("cliente@test.com");
        when(promocionService.canjearPromocion(anyLong(), anyString()))
                .thenThrow(new ResourceNotFoundException("Promoción no encontrada"));

        assertThrows(ResourceNotFoundException.class, () -> controller.canjear(dto(1L, 404L), authentication));
    }

    @Test
    void canjearConUsuarioIdNuloEnElBodySigueFuncionandoPorqueSeIgnora() {
        Authentication authentication = authComo("otro@test.com");
        when(promocionService.canjearPromocion(3L, "otro@test.com")).thenReturn(mock(Canje.class));

        ResponseEntity<?> res = controller.canjear(dto(null, 3L), authentication);

        assertEquals(200, res.getStatusCode().value());
        ArgumentCaptor<String> emailCaptor = ArgumentCaptor.forClass(String.class);
        verify(promocionService).canjearPromocion(eq(3L), emailCaptor.capture());
        assertEquals("otro@test.com", emailCaptor.getValue());
    }
}
