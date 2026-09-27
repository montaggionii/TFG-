package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura de CompraService, sin cubrir hasta ahora (solo vivía en la
 * suite E2E, que requiere backend/frontend/MySQL reales). El email del
 * restaurante que otorga los puntos llega desde `Authentication`
 * (CompraController, nunca del body del cliente), así que no hay
 * vulnerabilidad de autorización aquí que probar (a diferencia de
 * FID-005/FID-013/FID-015); esta suite se centra en la lógica de negocio
 * de acumulación de puntos (1€ = 1 punto) y sus validaciones.
 */
@ExtendWith(MockitoExtension.class)
class CompraServiceTest {

    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;

    private CompraService compraService;

    @BeforeEach
    void setUp() {
        compraService = new CompraService(usuarioDAO, restauranteDAO, movimientoPuntosDAO);
    }

    private Usuario usuario(long id, int puntos) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setPuntos(puntos);
        return u;
    }

    private Restaurante restaurante(String email) {
        Restaurante r = new Restaurante();
        r.setId(1L);
        r.setNombre("Mexican Food");
        r.setEmail(email);
        return r;
    }

    @Test
    void importeCeroLanzaBadRequestSinConsultarNada() {
        assertThrows(BadRequestException.class,
                () -> compraService.registrarCompra(1L, 0, "mexicanfood@fidelyfood.local"));
        verifyNoInteractions(usuarioDAO, restauranteDAO, movimientoPuntosDAO);
    }

    @Test
    void importeNegativoLanzaBadRequestSinConsultarNada() {
        assertThrows(BadRequestException.class,
                () -> compraService.registrarCompra(1L, -5.0, "mexicanfood@fidelyfood.local"));
        verifyNoInteractions(usuarioDAO, restauranteDAO, movimientoPuntosDAO);
    }

    @Test
    void usuarioInexistenteLanzaResourceNotFound() {
        when(usuarioDAO.findById(1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> compraService.registrarCompra(1L, 10.0, "mexicanfood@fidelyfood.local"));
        verifyNoInteractions(restauranteDAO, movimientoPuntosDAO);
    }

    @Test
    void restauranteInexistenteLanzaResourceNotFoundYNoTocaAlUsuario() {
        Usuario usuario = usuario(1L, 0);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findByEmail("fantasma@fidelyfood.local")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> compraService.registrarCompra(1L, 10.0, "fantasma@fidelyfood.local"));
        verify(usuarioDAO, never()).save(any());
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void importeMenorAUnEuroNoGeneraPuntosYLanzaBadRequest() {
        Usuario usuario = usuario(1L, 0);
        Restaurante restaurante = restaurante("mexicanfood@fidelyfood.local");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));

        assertThrows(BadRequestException.class,
                () -> compraService.registrarCompra(1L, 0.5, "mexicanfood@fidelyfood.local"));
        verify(usuarioDAO, never()).save(any());
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void compraValidaSumaPuntosYRegistraMovimientoGanado() {
        Usuario usuario = usuario(1L, 20);
        Restaurante restaurante = restaurante("mexicanfood@fidelyfood.local");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));

        compraService.registrarCompra(1L, 25.50, "mexicanfood@fidelyfood.local");

        assertEquals(45, usuario.getPuntos()); // 20 + (int) 25.50 = 45
        verify(usuarioDAO).save(usuario);
        verify(movimientoPuntosDAO).save(argThat(mov ->
                mov.getPuntos() == 25
                        && "GANADOS".equals(mov.getTipo())
                        && mov.getUsuario() == usuario
                        && mov.getRestaurante() == restaurante
                        && mov.getMonto() == 25.50));
    }
}
