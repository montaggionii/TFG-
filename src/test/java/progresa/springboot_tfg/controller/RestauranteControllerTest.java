package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dto.DashboardStatsDTO;
import progresa.springboot_tfg.dto.EstadisticasComparativasDTO;
import progresa.springboot_tfg.dto.RestauranteAdvancedStatsDTO;
import progresa.springboot_tfg.dto.RestauranteDTO;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.service.RestauranteService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-047 — RestauranteController era el único controlador de negocio no
 * trivial (junto a TestController) sin ningún test propio, a diferencia del
 * resto (AGT-017/019/020/021/022/033/035/036/039/042). Toda su lógica de
 * autorización vive ya en RestauranteService (requireOwner, cubierto por
 * RestauranteServiceTest) — este controlador es un paso directo hacia el
 * servicio, así que estos tests fijan únicamente la parte que no cubre
 * ningún test de servicio: que cada método usa siempre
 * SecurityUtils.email(authentication), nunca ningún otro valor, y que los
 * parámetros (incluido el MultipartFile de /imagen y los query params con
 * su valor por defecto de /estadisticas) llegan al servicio tal cual.
 */
@ExtendWith(MockitoExtension.class)
class RestauranteControllerTest {

    @Mock
    private RestauranteService restauranteService;

    private RestauranteController controller;

    @BeforeEach
    void setUp() {
        controller = new RestauranteController(restauranteService);
    }

    private Authentication authAs(String email) {
        return new UsernamePasswordAuthenticationToken(
                email, "N/A", List.of(new SimpleGrantedAuthority("ROLE_RESTAURANT")));
    }

    private RestauranteDTO restauranteDTO(Long id, String nombre) {
        RestauranteDTO dto = new RestauranteDTO();
        dto.setId(id);
        dto.setNombre(nombre);
        return dto;
    }

    @Test
    void obtenerTodosDevuelveLaListaDelServicio() {
        when(restauranteService.obtenerTodosDTO())
                .thenReturn(List.of(restauranteDTO(1L, "La Consentida")));

        ResponseEntity<List<RestauranteDTO>> res = controller.obtenerTodos();

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, res.getBody().size());
    }

    @Test
    void obtenerPorIdDelegaEnElServicioConElIdDeLaRuta() {
        when(restauranteService.obtenerPorIdDTO(1L)).thenReturn(restauranteDTO(1L, "La Consentida"));

        ResponseEntity<RestauranteDTO> res = controller.obtenerPorId(1L);

        assertEquals(200, res.getStatusCode().value());
        assertEquals("La Consentida", res.getBody().getNombre());
    }

    @Test
    void obtenerCercanosUsaElRadioPorDefectoDeDiezKmDelController() {
        when(restauranteService.obtenerCercanosDTO(40.4, -3.7, 10))
                .thenReturn(List.of(restauranteDTO(1L, "La Consentida")));

        ResponseEntity<List<RestauranteDTO>> res = controller.obtenerCercanos(40.4, -3.7, 10);

        assertEquals(200, res.getStatusCode().value());
        verify(restauranteService).obtenerCercanosDTO(40.4, -3.7, 10);
    }

    @Test
    void obtenerStatsDelegaConElEmailAutenticadoNuncaUnoDelCuerpo() {
        DashboardStatsDTO stats = new DashboardStatsDTO(5, 100, 40, 2, List.of());
        when(restauranteService.obtenerStats(1L, "resto@test.com")).thenReturn(stats);

        ResponseEntity<DashboardStatsDTO> res = controller.obtenerStats(1L, authAs("resto@test.com"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(5, res.getBody().getClientesUnicos());
        verify(restauranteService).obtenerStats(1L, "resto@test.com");
    }

    @Test
    void obtenerStatsAvanzadasDelegaConElEmailAutenticado() {
        RestauranteAdvancedStatsDTO stats = new RestauranteAdvancedStatsDTO(1000.0, 100, 40, 5, 10, 100.0, List.of());
        when(restauranteService.obtenerStatsAvanzadas(1L, "resto@test.com")).thenReturn(stats);

        ResponseEntity<RestauranteAdvancedStatsDTO> res =
                controller.obtenerStatsAvanzadas(1L, authAs("resto@test.com"));

        assertEquals(200, res.getStatusCode().value());
        verify(restauranteService).obtenerStatsAvanzadas(1L, "resto@test.com");
    }

    @Test
    void obtenerEstadisticasPeriodoUsaSemanaYCompararPorDefectoDelController() {
        EstadisticasComparativasDTO stats = new EstadisticasComparativasDTO(null, null, null, null, null);
        when(restauranteService.obtenerEstadisticasPeriodo(1L, "resto@test.com", "SEMANA", true))
                .thenReturn(stats);

        ResponseEntity<EstadisticasComparativasDTO> res =
                controller.obtenerEstadisticasPeriodo(1L, "SEMANA", true, authAs("resto@test.com"));

        assertEquals(200, res.getStatusCode().value());
        verify(restauranteService).obtenerEstadisticasPeriodo(1L, "resto@test.com", "SEMANA", true);
    }

    @Test
    void actualizarDelegaConElEmailAutenticadoNuncaUnoDelCuerpo() {
        Restaurante cambios = new Restaurante();
        cambios.setNombre("Nuevo Nombre");
        Restaurante actualizado = new Restaurante();
        actualizado.setNombre("Nuevo Nombre");
        when(restauranteService.actualizar(eq(1L), eq(cambios), eq("resto@test.com")))
                .thenReturn(actualizado);

        ResponseEntity<Restaurante> res = controller.actualizar(1L, cambios, authAs("resto@test.com"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("Nuevo Nombre", res.getBody().getNombre());
        verify(restauranteService).actualizar(1L, cambios, "resto@test.com");
    }

    @Test
    void subirImagenDelegaConElArchivoYElEmailAutenticado() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "logo.jpg", "image/jpeg", new byte[]{1, 2, 3});
        when(restauranteService.subirImagen(1L, file, "resto@test.com"))
                .thenReturn(restauranteDTO(1L, "La Consentida"));

        ResponseEntity<RestauranteDTO> res = controller.subirImagen(1L, file, authAs("resto@test.com"));

        assertEquals(200, res.getStatusCode().value());
        verify(restauranteService).subirImagen(1L, file, "resto@test.com");
    }

    @Test
    void eliminarDelegaEnEliminarPropioConElEmailAutenticado() {
        ResponseEntity<Void> res = controller.eliminar(1L, authAs("resto@test.com"));

        assertEquals(204, res.getStatusCode().value());
        verify(restauranteService).eliminarPropio(1L, "resto@test.com");
    }
}
