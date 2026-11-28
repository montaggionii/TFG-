package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Cobertura de InsightRestauranteService — tras AGT-057 (PuntosStreamService)
 * era el último servicio de negocio del backend sin ningún test unitario
 * (aparte de QrService, trivial). Es puro cálculo/agregación sobre la lista
 * de movimientos de puntos del restaurante: sin acceso a BD real, se puede
 * fijar todo su comportamiento con mocks de los tres DAOs que usa.
 *
 * La autorización (ownership) no se prueba aquí: `RestauranteController.
 * obtenerInsights` ya llama primero a `RestauranteService.obtenerStats(id,
 * email)` (que sí aplica `requireOwner`) solo por su efecto de lanzar
 * AccessDeniedException si el restaurante autenticado no es el dueño, antes
 * de llamar a este servicio — mismo patrón ya verificado en otros tests de
 * RestauranteService/RestauranteController.
 */
@ExtendWith(MockitoExtension.class)
class InsightRestauranteServiceTest {

    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;
    @Mock
    private UsuarioDAO usuarioDAO;

    private InsightRestauranteService insightRestauranteService;

    @BeforeEach
    void setUp() {
        insightRestauranteService = new InsightRestauranteService(restauranteDAO, movimientoPuntosDAO, usuarioDAO);
    }

    private Restaurante restaurante(Long id) {
        Restaurante r = new Restaurante();
        r.setId(id);
        return r;
    }

    private Usuario usuario(Long id, String nombre, int puntos, Boolean deleted) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setNombre(nombre);
        u.setPuntos(puntos);
        u.setDeleted(deleted);
        return u;
    }

    private MovimientoPuntos movimiento(Usuario usuario, Restaurante restaurante, int puntos,
                                         String descripcion, LocalDateTime fecha) {
        MovimientoPuntos m = new MovimientoPuntos();
        m.setUsuario(usuario);
        m.setRestaurante(restaurante);
        m.setPuntos(puntos);
        m.setDescripcion(descripcion);
        m.setFecha(fecha);
        return m;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> inactivosDe(Map<String, Object> resumen) {
        return (List<Map<String, Object>>) resumen.get("clientesInactivos");
    }

    @Test
    void restauranteInexistenteLanzaResourceNotFoundYNoConsultaMovimientos() {
        when(restauranteDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> insightRestauranteService.insights(99L));
        verifyNoInteractions(movimientoPuntosDAO, usuarioDAO);
    }

    @Test
    void sinMovimientosDevuelveResumenVacioConSugerenciaDeArranque() {
        Restaurante restaurante = restaurante(1L);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of());

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(0, resumen.get("clientesTotales"));
        assertEquals(0L, resumen.get("clientesRecurrentes"));
        assertTrue(inactivosDe(resumen).isEmpty());
        assertEquals(0, resumen.get("ganadosMes"));
        assertEquals(0, resumen.get("canjeadosMes"));
        assertNull(resumen.get("promoMasCanjeada"));
        assertTrue(((String) resumen.get("sugerencia")).contains("escáner"));
    }

    @Test
    void movimientosDeUnUsuarioBorradoSeExcluyenPorCompleto() {
        Restaurante restaurante = restaurante(1L);
        Usuario borrado = usuario(2L, "Cliente Borrado", 50, true);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(borrado, restaurante, 10, "Compra", LocalDateTime.now())));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(0, resumen.get("clientesTotales"));
        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void movimientosDeOtroRestauranteDevueltosPorErrorSeIgnoran() {
        Restaurante restaurante = restaurante(1L);
        Restaurante otro = restaurante(2L);
        Usuario cliente = usuario(3L, "Cliente Ajeno", 10, false);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, otro, 10, "Compra en otro local", LocalDateTime.now())));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(0, resumen.get("clientesTotales"));
        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void clienteSinVisitaEnMasDeTresSemanasApareceComoInactivoConDiasCorrectos() {
        Restaurante restaurante = restaurante(1L);
        Usuario cliente = usuario(2L, "Cliente Inactivo", 30, false);
        LocalDateTime haceCuatroSemanas = LocalDateTime.now().minusWeeks(4);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, restaurante, 10, "Compra", haceCuatroSemanas)));
        when(usuarioDAO.findById(2L)).thenReturn(Optional.of(cliente));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        List<Map<String, Object>> inactivos = inactivosDe(resumen);
        assertEquals(1, inactivos.size());
        assertEquals(2L, inactivos.get(0).get("id"));
        assertEquals("Cliente Inactivo", inactivos.get(0).get("nombre"));
        assertEquals(30, inactivos.get(0).get("puntos"));
        assertEquals(28L, (long) inactivos.get(0).get("diasSinVolver"));
    }

    @Test
    void clienteConVisitaRecienteNuncaApareceComoInactivo() {
        Restaurante restaurante = restaurante(1L);
        Usuario cliente = usuario(2L, "Cliente Reciente", 10, false);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, restaurante, 10, "Compra", LocalDateTime.now().minusDays(2))));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertTrue(inactivosDe(resumen).isEmpty());
        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void clienteConDosOMasVisitasCuentaComoRecurrente() {
        Restaurante restaurante = restaurante(1L);
        Usuario cliente = usuario(2L, "Cliente Fiel", 10, false);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, restaurante, 10, "Compra 1", LocalDateTime.now().minusDays(10)),
                movimiento(cliente, restaurante, 5, "Compra 2", LocalDateTime.now().minusDays(1))));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(1L, resumen.get("clientesRecurrentes"));
    }

    @Test
    void conTresOMasInactivosLaSugerenciaPriorizaDoblePuntosAunHabiendoRecurrentes() {
        Restaurante restaurante = restaurante(1L);
        LocalDateTime haceCuatroSemanas = LocalDateTime.now().minusWeeks(4);
        LocalDateTime haceCincoSemanas = LocalDateTime.now().minusWeeks(5);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        // 3 clientes inactivos (>=3 semanas) que además son recurrentes (2 visitas cada uno):
        // ambas condiciones de sugerencia() se cumplen a la vez, debe ganar la de inactivos.
        List<MovimientoPuntos> movimientos = List.of(
                movimiento(usuario(1L, "A", 0, false), restaurante, 10, "Compra", haceCincoSemanas),
                movimiento(usuario(1L, "A", 0, false), restaurante, 10, "Compra", haceCuatroSemanas),
                movimiento(usuario(2L, "B", 0, false), restaurante, 10, "Compra", haceCincoSemanas),
                movimiento(usuario(2L, "B", 0, false), restaurante, 10, "Compra", haceCuatroSemanas),
                movimiento(usuario(3L, "C", 0, false), restaurante, 10, "Compra", haceCincoSemanas),
                movimiento(usuario(3L, "C", 0, false), restaurante, 10, "Compra", haceCuatroSemanas));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(movimientos);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario(1L, "A", 0, false)));
        when(usuarioDAO.findById(2L)).thenReturn(Optional.of(usuario(2L, "B", 0, false)));
        when(usuarioDAO.findById(3L)).thenReturn(Optional.of(usuario(3L, "C", 0, false)));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(3, inactivosDe(resumen).size());
        assertEquals(3L, resumen.get("clientesRecurrentes"));
        assertTrue(((String) resumen.get("sugerencia")).contains("no vuelven"));
    }

    @Test
    void sinInactivosPeroConDosOMasRecurrentesLaSugerenciaOfreceCanjear() {
        Restaurante restaurante = restaurante(1L);
        LocalDateTime reciente1 = LocalDateTime.now().minusDays(1);
        LocalDateTime reciente2 = LocalDateTime.now().minusDays(2);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(usuario(1L, "A", 0, false), restaurante, 10, "Compra", reciente1),
                movimiento(usuario(1L, "A", 0, false), restaurante, 10, "Compra", reciente2),
                movimiento(usuario(2L, "B", 0, false), restaurante, 10, "Compra", reciente1),
                movimiento(usuario(2L, "B", 0, false), restaurante, 10, "Compra", reciente2)));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertTrue(inactivosDe(resumen).isEmpty());
        assertEquals(2L, resumen.get("clientesRecurrentes"));
        assertTrue(((String) resumen.get("sugerencia")).contains("CANJEAR"));
    }

    @Test
    void ganadosYCanjeadosDelMesIgnoranMovimientosDeMesesAnteriores() {
        Restaurante restaurante = restaurante(1L);
        Usuario cliente = usuario(2L, "Cliente", 10, false);
        LocalDateTime esteMes = LocalDateTime.now().withDayOfMonth(1).plusDays(2);
        LocalDateTime mesPasado = LocalDateTime.now().minusMonths(2);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, restaurante, 20, "Compra este mes", esteMes),
                movimiento(cliente, restaurante, -8, "Canje este mes", esteMes),
                movimiento(cliente, restaurante, 100, "Compra mes pasado", mesPasado),
                movimiento(cliente, restaurante, -40, "Canje mes pasado", mesPasado)));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        assertEquals(20, resumen.get("ganadosMes"));
        assertEquals(-8, resumen.get("canjeadosMes"));
    }

    @Test
    void promoMasCanjeadaEsLaDescripcionConMasCanjesDelMes() {
        Restaurante restaurante = restaurante(1L);
        Usuario cliente = usuario(2L, "Cliente", 10, false);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(1L)).thenReturn(List.of(
                movimiento(cliente, restaurante, -10, "2x1 en postres", LocalDateTime.now()),
                movimiento(cliente, restaurante, -10, "2x1 en postres", LocalDateTime.now()),
                movimiento(cliente, restaurante, -5, "Café gratis", LocalDateTime.now())));

        Map<String, Object> resumen = insightRestauranteService.insights(1L);

        @SuppressWarnings("unchecked")
        Map<String, Object> promoMasCanjeada = (Map<String, Object>) resumen.get("promoMasCanjeada");
        assertEquals("2x1 en postres", promoMasCanjeada.get("promocion"));
        assertEquals(2L, promoMasCanjeada.get("canjes"));
    }
}
