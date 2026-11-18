package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import progresa.springboot_tfg.dao.CanjeDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Canje;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura del canje con QR temporal de un solo uso: el camarero solo
 * valida canjes de su restaurante y con el token vivo; el cliente puede
 * cancelar un canje pendiente y recupera los puntos.
 */
@ExtendWith(MockitoExtension.class)
class CanjeServiceTest {

    @Mock
    private CanjeDAO canjeDAO;
    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;

    private CanjeService canjeService;

    private Canje canje;
    private Restaurante restaurante;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        canjeService = new CanjeService(canjeDAO, usuarioDAO, movimientoPuntosDAO);

        restaurante = new Restaurante();
        restaurante.setId(4L);
        restaurante.setEmail("resto@test.com");

        usuario = new Usuario();
        usuario.setId(16L);
        usuario.setNombre("Cliente");
        usuario.setEmail("cliente@test.com");
        usuario.setPuntos(20);

        Promocion promo = new Promocion();
        promo.setId(1L);
        promo.setTitulo("Café gratis");
        promo.setRestaurante(restaurante);

        canje = new Canje();
        canje.setId(9L);
        canje.setUsuario(usuario);
        canje.setPromocion(promo);
        canje.setPuntosGastados(20);
        canje.setEstado("PENDIENTE");
        canje.setToken("tokensecreto");
        canje.setTokenExpira(LocalDateTime.now().plusMinutes(5));
    }

    @Test
    void validarConElRestaurantePropietarioMarcaValidado() {
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));
        when(canjeDAO.save(canje)).thenReturn(canje);

        Canje resultado = canjeService.validar(9L, "CANJE:9:tokensecreto", "resto@test.com");

        assertEquals("VALIDADO", resultado.getEstado());
        assertNotNull(resultado.getFechaValidacion());
    }

    @Test
    void validarDesdeOtroRestauranteLanzaAccessDenied() {
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(AccessDeniedException.class,
                () -> canjeService.validar(9L, "CANJE:9:tokensecreto", "otro@test.com"));
    }

    @Test
    void validarConCodigoIncorrectoLanzaBadRequest() {
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(BadRequestException.class,
                () -> canjeService.validar(9L, "CANJE:9:otro-token", "resto@test.com"));
    }

    @Test
    void validarConTokenCaducadoLanzaBadRequest() {
        canje.setTokenExpira(LocalDateTime.now().minusMinutes(1));
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(BadRequestException.class,
                () -> canjeService.validar(9L, "CANJE:9:tokensecreto", "resto@test.com"));
        verify(canjeDAO, never()).save(any());
    }

    @Test
    void validarCanjeYaValidadoLanzaBadRequest() {
        canje.setEstado("VALIDADO");
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(BadRequestException.class,
                () -> canjeService.validar(9L, "CANJE:9:tokensecreto", "resto@test.com"));
    }

    @Test
    void cancelarPorElClienteDevuelveLosPuntos() {
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));
        when(canjeDAO.save(canje)).thenReturn(canje);
        when(usuarioDAO.save(usuario)).thenReturn(usuario);

        Canje resultado = canjeService.cancelar(9L, "cliente@test.com");

        assertEquals("CANCELADO", resultado.getEstado());
        assertNull(resultado.getToken());
        assertEquals(40, usuario.getPuntos()); // 20 + 20 devueltos
        verify(movimientoPuntosDAO).save(any(MovimientoPuntos.class));
    }

    @Test
    void cancelarDesdeOtroUsuarioLanzaAccessDenied() {
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(AccessDeniedException.class,
                () -> canjeService.cancelar(9L, "otro@test.com"));
    }

    @Test
    void cancelarCanjeYaValidadoLanzaBadRequest() {
        canje.setEstado("VALIDADO");
        when(canjeDAO.findById(9L)).thenReturn(Optional.of(canje));

        assertThrows(BadRequestException.class,
                () -> canjeService.cancelar(9L, "cliente@test.com"));
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void validarCanjeInexistenteLanzaNotFound() {
        when(canjeDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> canjeService.validar(99L, "CANJE:99:x", "resto@test.com"));
    }
}
