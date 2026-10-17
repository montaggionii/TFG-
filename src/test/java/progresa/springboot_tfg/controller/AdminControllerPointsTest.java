package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import progresa.springboot_tfg.dao.AdminLogDAO;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.service.RestauranteService;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-xxx — AdminController no tenía ningún test propio a pesar de ser el
 * único punto donde un administrador puede ajustar manualmente el saldo de
 * puntos de un cliente (POST /api/clients/{id}/points/add|subtract|set).
 * Estos tests fijan el comportamiento real de applyPointChange (vía los
 * endpoints públicos) para que una regresión de signo/orden la detecte un
 * test, no una auditoría manual: saldo insuficiente nunca debe dejar un
 * cliente en negativo, y un restaurantId inexistente no debe mutar puntos
 * a medias (el saldo solo se guarda después de validar todo lo demás).
 */
@ExtendWith(MockitoExtension.class)
class AdminControllerPointsTest {

    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;
    @Mock
    private AdminLogDAO adminLogDAO;
    @Mock
    private AdminReservationDAO adminReservationDAO;
    @Mock
    private RestauranteService restauranteService;

    private AdminController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminController(usuarioDAO, restauranteDAO, movimientoPuntosDAO, adminLogDAO, adminReservationDAO, restauranteService);
    }

    private Usuario clienteConPuntos(int puntos) {
        Usuario usuario = new Usuario("Cliente Test", "cliente@test.com", "hash", puntos);
        usuario.setId(1L);
        usuario.setRole(Role.ROLE_USER);
        return usuario;
    }

    @Test
    void addPointsSumaLosPuntosYRegistraElMovimiento() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> res = controller.addPoints(1L, Map.of("amount", 50));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(150, cliente.getPuntos());

        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        assertEquals(50, captor.getValue().getPuntos());
        assertEquals("AJUSTE_ADMIN", captor.getValue().getTipo());
    }

    @Test
    void subtractPointsRestaLosPuntosCorrectamente() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.subtractPoints(1L, Map.of("amount", 30));

        assertEquals(70, cliente.getPuntos());
        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        assertEquals(-30, captor.getValue().getPuntos());
    }

    @Test
    void subtractPointsConSaldoInsuficienteLanzaBadRequestYNoGuardaNada() {
        Usuario cliente = clienteConPuntos(20);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));

        assertThrows(BadRequestException.class, () -> controller.subtractPoints(1L, Map.of("amount", 50)));

        assertEquals(20, cliente.getPuntos(), "el saldo del cliente no debe cambiar si la resta lo deja en negativo");
        verify(usuarioDAO, never()).save(any());
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void setPointsCalculaElDeltaCorrectoRespectoAlSaldoActual() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.setPoints(1L, Map.of("amount", 40));

        assertEquals(40, cliente.getPuntos());
        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        assertEquals(-60, captor.getValue().getPuntos(), "set de 100 a 40 debe registrarse como un movimiento de -60");
    }

    @Test
    void setPointsConValorNegativoLanzaBadRequest() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));

        assertThrows(BadRequestException.class, () -> controller.setPoints(1L, Map.of("amount", -5)));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void addPointsConCantidadCeroONegativaLanzaBadRequest() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));

        assertThrows(BadRequestException.class, () -> controller.addPoints(1L, Map.of("amount", 0)));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void addPointsConTipoDeMovimientoNoValidoLanzaBadRequest() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));

        assertThrows(BadRequestException.class, () -> controller.addPoints(1L, Map.of("amount", 10, "type", "REGALO_SOSPECHOSO")));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void addPointsConRestaurantIdInexistenteNoMutaPuntosAMedias() {
        Usuario cliente = clienteConPuntos(100);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));
        when(restauranteDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.addPoints(1L, Map.of("amount", 10, "restaurantId", 99L)));

        assertEquals(100, cliente.getPuntos(), "si el restaurante no existe, el saldo no debe haberse tocado ya");
        verify(usuarioDAO, never()).save(any());
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void noSePuedeAjustarPuntosDeUnaCuentaAdmin() {
        Usuario admin = clienteConPuntos(0);
        admin.setRole(Role.ROLE_ADMIN);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(admin));

        assertThrows(BadRequestException.class, () -> controller.addPoints(1L, Map.of("amount", 10)));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void noSePuedeAjustarPuntosDeUnClienteYaEliminado() {
        Usuario cliente = clienteConPuntos(100);
        cliente.setDeleted(true);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));

        assertThrows(BadRequestException.class, () -> controller.addPoints(1L, Map.of("amount", 10)));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void addPointsSobreUnRestauranteReal404SiNoExiste() {
        when(usuarioDAO.findById(2L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.addPoints(2L, Map.of("amount", 10)));
    }

    @Test
    void addPointsConRestaurantIdValidoAsociaElMovimientoAEseRestaurante() {
        Usuario cliente = clienteConPuntos(100);
        Restaurante restaurante = new Restaurante();
        restaurante.setId(5L);
        restaurante.setNombre("Alabroster");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(cliente));
        when(restauranteDAO.findById(5L)).thenReturn(Optional.of(restaurante));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.addPoints(1L, Map.of("amount", 10, "restaurantId", 5L));

        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        assertEquals(5L, captor.getValue().getRestaurante().getId());
    }
}
