package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * AGT-xxx — PuntosController no tenía ningún test propio a pesar de tener
 * comprobaciones de autorización (ownership de usuario, y que un restaurante
 * solo pueda asignar puntos en su propio nombre) escritas directamente en el
 * controlador, no delegadas a un servicio con su propio requireOwner como el
 * resto del backend. Fija ese comportamiento para que una regresión futura
 * la detecte un test en rojo, no una auditoría manual.
 */
@ExtendWith(MockitoExtension.class)
class PuntosControllerTest {

    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;

    private PuntosController controller;

    @BeforeEach
    void setUp() {
        controller = new PuntosController(usuarioDAO, restauranteDAO, movimientoPuntosDAO);
    }

    private Authentication authAs(String email, String role) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority(role)));
    }

    private Usuario usuarioConPuntos(Long id, String email, int puntos) {
        Usuario usuario = new Usuario("Cliente Test", email, "hash", puntos);
        usuario.setId(id);
        return usuario;
    }

    private Restaurante restaurante(Long id, String email, String nombre) {
        Restaurante restaurante = new Restaurante();
        restaurante.setId(id);
        restaurante.setEmail(email);
        restaurante.setNombre(nombre);
        return restaurante;
    }

    @Test
    void totalUsuarioDelPropioUsuarioDevuelveSusPuntos() {
        Usuario usuario = usuarioConPuntos(1L, "cliente@test.com", 120);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        ResponseEntity<Map<String, Integer>> res = controller.totalUsuario(1L, authAs("cliente@test.com", "ROLE_USER"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(120, res.getBody().get("puntos"));
    }

    @Test
    void totalUsuarioDeOtroUsuarioLanzaAccessDenied() {
        Usuario usuario = usuarioConPuntos(1L, "cliente@test.com", 120);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(AccessDeniedException.class,
                () -> controller.totalUsuario(1L, authAs("otro@test.com", "ROLE_USER")));
    }

    @Test
    void totalUsuarioConRolDistintoDeUserLanzaAccessDeniedSinConsultarElDAO() {
        assertThrows(AccessDeniedException.class,
                () -> controller.totalUsuario(1L, authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void totalUsuarioInexistenteLanzaResourceNotFound() {
        when(usuarioDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> controller.totalUsuario(99L, authAs("cliente@test.com", "ROLE_USER")));
    }

    @Test
    void puntosPorRestauranteSoloSumaLosMovimientosDeEseRestaurante() {
        Usuario usuario = usuarioConPuntos(1L, "cliente@test.com", 500);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        Restaurante restauranteA = restaurante(5L, "a@test.com", "Restaurante A");
        Restaurante restauranteB = restaurante(6L, "b@test.com", "Restaurante B");

        MovimientoPuntos movA1 = new MovimientoPuntos();
        movA1.setPuntos(30);
        movA1.setRestaurante(restauranteA);
        MovimientoPuntos movA2 = new MovimientoPuntos();
        movA2.setPuntos(20);
        movA2.setRestaurante(restauranteA);
        MovimientoPuntos movB = new MovimientoPuntos();
        movB.setPuntos(1000);
        movB.setRestaurante(restauranteB);
        MovimientoPuntos movSinRestaurante = new MovimientoPuntos();
        movSinRestaurante.setPuntos(999);
        movSinRestaurante.setRestaurante(null);

        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(List.of(movA1, movA2, movB, movSinRestaurante));

        ResponseEntity<Map<String, Integer>> res =
                controller.puntosPorRestaurante(1L, 5L, authAs("cliente@test.com", "ROLE_USER"));

        assertEquals(50, res.getBody().get("puntos"));
    }

    @Test
    void sumarPuntosConRolDistintoDeRestaurantLanzaAccessDeniedSinGuardarNada() {
        assertThrows(AccessDeniedException.class,
                () -> controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 10.0, "puntos", 10),
                        authAs("cliente@test.com", "ROLE_USER")));

        verifyNoInteractions(usuarioDAO, movimientoPuntosDAO);
    }

    @Test
    void sumarPuntosSinRestauranteAutenticadoLanzaResourceNotFound() {
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 10.0, "puntos", 10),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));
    }

    @Test
    void sumarPuntosSinUsuarioIdLanzaBadRequest() {
        when(restauranteDAO.findByEmail("restaurante@test.com"))
                .thenReturn(Optional.of(restaurante(5L, "restaurante@test.com", "Alabroster")));

        assertThrows(BadRequestException.class,
                () -> controller.sumarPuntos(Map.of("monto", 10.0, "puntos", 10),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void sumarPuntosConRestauranteIdDeOtroRestauranteLanzaAccessDenied() {
        when(restauranteDAO.findByEmail("restaurante@test.com"))
                .thenReturn(Optional.of(restaurante(5L, "restaurante@test.com", "Alabroster")));

        assertThrows(AccessDeniedException.class,
                () -> controller.sumarPuntos(
                        Map.of("usuarioId", 1L, "restauranteId", 6L, "monto", 10.0, "puntos", 10),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verify(usuarioDAO, never()).save(any());
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void sumarPuntosConMontoCeroLanzaBadRequestSinGuardarNada() {
        when(restauranteDAO.findByEmail("restaurante@test.com"))
                .thenReturn(Optional.of(restaurante(5L, "restaurante@test.com", "Alabroster")));

        assertThrows(BadRequestException.class,
                () -> controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 0.0, "puntos", 10),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verify(usuarioDAO, never()).save(any());
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void sumarPuntosConPuntosNegativosLanzaBadRequestSinGuardarNada() {
        when(restauranteDAO.findByEmail("restaurante@test.com"))
                .thenReturn(Optional.of(restaurante(5L, "restaurante@test.com", "Alabroster")));

        assertThrows(BadRequestException.class,
                () -> controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 10.0, "puntos", -5),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verify(usuarioDAO, never()).save(any());
        verify(movimientoPuntosDAO, never()).save(any());
    }

    @Test
    void sumarPuntosConUsuarioInexistenteLanzaResourceNotFound() {
        when(restauranteDAO.findByEmail("restaurante@test.com"))
                .thenReturn(Optional.of(restaurante(5L, "restaurante@test.com", "Alabroster")));
        when(usuarioDAO.findById(1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 10.0, "puntos", 10),
                        authAs("restaurante@test.com", "ROLE_RESTAURANT")));
    }

    @Test
    void sumarPuntosValidosSumaLosPuntosYRegistraElMovimientoConElRestauranteCorrecto() {
        Restaurante restaurante = restaurante(5L, "restaurante@test.com", "Alabroster");
        Usuario usuario = usuarioConPuntos(1L, "cliente@test.com", 100);
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.of(restaurante));
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<Map<String, Object>> res = controller.sumarPuntos(
                Map.of("usuarioId", 1L, "restauranteId", 5L, "monto", 25.5, "puntos", 25),
                authAs("restaurante@test.com", "ROLE_RESTAURANT"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(125, usuario.getPuntos());

        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        MovimientoPuntos guardado = captor.getValue();
        assertEquals(25, guardado.getPuntos());
        assertEquals("GANADOS", guardado.getTipo());
        assertEquals(5L, guardado.getRestaurante().getId());
    }

    @Test
    void sumarPuntosSinRestauranteIdEnElCuerpoUsaSiempreElRestauranteAutenticado() {
        Restaurante restaurante = restaurante(5L, "restaurante@test.com", "Alabroster");
        Usuario usuario = usuarioConPuntos(1L, "cliente@test.com", 0);
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.of(restaurante));
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.sumarPuntos(Map.of("usuarioId", 1L, "monto", 10.0, "puntos", 10),
                authAs("restaurante@test.com", "ROLE_RESTAURANT"));

        ArgumentCaptor<MovimientoPuntos> captor = ArgumentCaptor.forClass(MovimientoPuntos.class);
        verify(movimientoPuntosDAO).save(captor.capture());
        assertEquals(5L, captor.getValue().getRestaurante().getId());
    }
}
