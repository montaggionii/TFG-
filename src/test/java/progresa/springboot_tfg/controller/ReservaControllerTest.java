package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminReservation;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.service.ReservaService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-060 — ReservaController (POST/GET /api/reservas*) no tenía ningún test
 * propio. A diferencia de los demás controladores grandes (AdminController,
 * PuntosController, PromocionController, FavoritoController...), {@code mias}
 * y {@code delRestaurante} no delegan en ReservaService: consultan
 * AdminReservationDAO directamente por el id del usuario/restaurante
 * autenticado, resuelto siempre a partir del email del JWT (nunca de la
 * ruta/body) — mismo patrón de ownership ya establecido, pero sin ningún
 * test que lo fije.
 */
@ExtendWith(MockitoExtension.class)
class ReservaControllerTest {

    @Mock
    private ReservaService reservaService;

    @Mock
    private AdminReservationDAO reservaDAO;

    @Mock
    private UsuarioDAO usuarioDAO;

    @Mock
    private RestauranteDAO restauranteDAO;

    private ReservaController controller;

    private Authentication authComo(String email) {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn(email);
        return authentication;
    }

    private Usuario usuarioConId(Long id) {
        Usuario usuario = new Usuario();
        usuario.setId(id);
        return usuario;
    }

    private Restaurante restauranteConId(Long id) {
        Restaurante restaurante = new Restaurante();
        restaurante.setId(id);
        return restaurante;
    }

    private AdminReservation reservaConId(Long id) {
        AdminReservation reserva = new AdminReservation();
        ReflectionTestUtils.setField(reserva, "id", id);
        reserva.setStatus("PENDING");
        reserva.setPeople(2);
        return reserva;
    }

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        controller = new ReservaController(reservaService, reservaDAO, usuarioDAO, restauranteDAO);
    }

    @Test
    void miasUsaSiempreElUsuarioDelJwtNuncaUnIdExterno() {
        Authentication authentication = authComo("cliente@test.com");
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuarioConId(5L)));
        when(reservaDAO.findByUsuarioIdAndDeletedFalseOrderByDateDesc(5L))
                .thenReturn(List.of(reservaConId(1L), reservaConId(2L)));

        ResponseEntity<List<Map<String, Object>>> res = controller.mias(authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(2, res.getBody().size());
        verify(reservaDAO, never()).findByUsuarioIdAndDeletedFalseOrderByDateDesc(eq(99L));
    }

    @Test
    void miasPropagaNotFoundSiElUsuarioDelJwtNoExiste() {
        Authentication authentication = authComo("fantasma@test.com");
        when(usuarioDAO.findByEmail("fantasma@test.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.mias(authentication));
    }

    @Test
    void delRestauranteUsaSiempreElRestauranteDelJwtNuncaUnIdExterno() {
        Authentication authentication = authComo("restaurante@test.com");
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.of(restauranteConId(10L)));
        when(reservaDAO.findByRestauranteIdAndDeletedFalseOrderByDateDesc(10L))
                .thenReturn(List.of(reservaConId(3L)));

        ResponseEntity<List<Map<String, Object>>> res = controller.delRestaurante(authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, res.getBody().size());
        verify(reservaDAO, never()).findByRestauranteIdAndDeletedFalseOrderByDateDesc(eq(404L));
    }

    @Test
    void delRestaurantePropagaNotFoundSiElRestauranteDelJwtNoExiste() {
        Authentication authentication = authComo("fantasma@test.com");
        when(restauranteDAO.findByEmail("fantasma@test.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.delRestaurante(authentication));
    }

    @Test
    void crearDelegaEnElServicioConElEmailAutenticadoNuncaUnoDelBody() {
        Authentication authentication = authComo("cliente@test.com");
        Map<String, Object> body = Map.of(
                "restauranteId", 7,
                "personas", 3,
                "fecha", "2027-01-01T20:00",
                "notas", "Mesa junto a la ventana"
        );
        when(reservaService.crear(eq(7L), eq("cliente@test.com"), eq(LocalDateTime.parse("2027-01-01T20:00")),
                eq(3), eq("Mesa junto a la ventana"))).thenReturn(reservaConId(1L));

        ResponseEntity<Map<String, Object>> res = controller.crear(body, authentication);

        assertEquals(200, res.getStatusCode().value());
        verify(reservaService).crear(7L, "cliente@test.com", LocalDateTime.parse("2027-01-01T20:00"), 3, "Mesa junto a la ventana");
    }

    @Test
    void crearRechazaUnaFechaConFormatoInvalidoAntesDeLlamarAlServicio() {
        Authentication authentication = mock(Authentication.class);
        Map<String, Object> body = Map.of(
                "restauranteId", 7,
                "personas", 3,
                "fecha", "no-es-una-fecha"
        );

        assertThrows(BadRequestException.class, () -> controller.crear(body, authentication));
        verify(reservaService, never()).crear(anyLong(), anyString(), any(), anyInt(), any());
    }

    @Test
    void crearRechazaUnaFechaAusenteAntesDeLlamarAlServicio() {
        Authentication authentication = mock(Authentication.class);
        Map<String, Object> body = Map.of("restauranteId", 7, "personas", 3);

        assertThrows(BadRequestException.class, () -> controller.crear(body, authentication));
        verify(reservaService, never()).crear(anyLong(), anyString(), any(), anyInt(), any());
    }

    @Test
    void cancelarDelegaEnElServicioConElIdYElEmailAutenticado() {
        Authentication authentication = authComo("cliente@test.com");
        AdminReservation cancelada = reservaConId(1L);
        cancelada.setStatus("CANCELLED");
        when(reservaService.cancelar(1L, "cliente@test.com")).thenReturn(cancelada);

        ResponseEntity<Map<String, Object>> res = controller.cancelar(1L, authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals("CANCELLED", res.getBody().get("estado"));
        verify(reservaService).cancelar(1L, "cliente@test.com");
    }

    @Test
    void estadoDelegaEnElServicioConElIdYElEmailAutenticado() {
        Authentication authentication = authComo("restaurante@test.com");
        AdminReservation confirmada = reservaConId(1L);
        confirmada.setStatus("CONFIRMED");
        when(reservaService.cambiarEstado(1L, "restaurante@test.com", "CONFIRMED")).thenReturn(confirmada);

        ResponseEntity<Map<String, Object>> res = controller.estado(1L, Map.of("estado", "CONFIRMED"), authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals("CONFIRMED", res.getBody().get("estado"));
        verify(reservaService).cambiarEstado(1L, "restaurante@test.com", "CONFIRMED");
    }

    @Test
    void toDtoUsaLosDatosDelClienteGuardadosSiNoHayUsuarioAsociado() {
        AdminReservation reserva = new AdminReservation();
        reserva.setClientName("Cliente Walk-in");
        reserva.setClientEmail("walkin@test.com");
        reserva.setClientPhone("600000000");
        reserva.setBusinessName("Restaurante de prueba");

        Map<String, Object> dto = ReservaController.toDto(reserva);

        assertEquals("Cliente Walk-in", dto.get("cliente"));
        assertEquals("walkin@test.com", dto.get("clienteEmail"));
        assertEquals("600000000", dto.get("clienteTelefono"));
        assertEquals("Restaurante de prueba", dto.get("restauranteNombre"));
        assertNull(dto.get("restauranteId"));
    }

    @Test
    void toDtoPrefiereLosDatosDelUsuarioYRestauranteAsociadosSobreLosGuardadosEnTexto() {
        Usuario usuario = usuarioConId(5L);
        usuario.setNombre("Cliente Real");
        usuario.setEmail("real@test.com");
        usuario.setTelefono("611111111");
        Restaurante restaurante = restauranteConId(10L);
        restaurante.setNombre("Restaurante Real");

        AdminReservation reserva = new AdminReservation();
        reserva.setUsuario(usuario);
        reserva.setRestaurante(restaurante);
        reserva.setClientName("Nombre viejo guardado en texto");

        Map<String, Object> dto = ReservaController.toDto(reserva);

        assertEquals("Cliente Real", dto.get("cliente"));
        assertEquals("real@test.com", dto.get("clienteEmail"));
        assertEquals("611111111", dto.get("clienteTelefono"));
        assertEquals("Restaurante Real", dto.get("restauranteNombre"));
        assertEquals(10L, dto.get("restauranteId"));
    }
}
