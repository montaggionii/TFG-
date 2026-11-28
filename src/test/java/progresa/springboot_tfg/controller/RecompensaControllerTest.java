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
import progresa.springboot_tfg.entity.Recompensa;
import progresa.springboot_tfg.service.RecompensaService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * AGT-xxx — RecompensaController no tenía ningún test propio a pesar de que
 * crear/actualizar/eliminar comprueban ROLE_ADMIN directamente en el
 * controlador (SecurityUtils.requireRole), no delegado a un servicio, igual
 * patrón que PuntosController (AGT-020) y CanjeController (AGT-021). Sin un
 * test que lo fije, una regresión que borrase esa llamada pasaría los tests
 * de RecompensaService (que no la ejercitan) sin que nada se diera cuenta.
 */
@ExtendWith(MockitoExtension.class)
class RecompensaControllerTest {

    @Mock
    private RecompensaService recompensaService;

    private RecompensaController controller;

    @BeforeEach
    void setUp() {
        controller = new RecompensaController(recompensaService);
    }

    private Authentication authAs(String email, String role) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority(role)));
    }

    private Recompensa recompensa(Long id, String nombre, int puntos) {
        Recompensa recompensa = new Recompensa();
        recompensa.setId(id);
        recompensa.setNombre(nombre);
        recompensa.setPuntosNecesarios(puntos);
        return recompensa;
    }

    @Test
    void obtenerTodasDevuelveLasRecompensasDelServicio() {
        when(recompensaService.obtenerTodas()).thenReturn(List.of(recompensa(1L, "Café gratis", 50)));

        ResponseEntity<List<Recompensa>> res = controller.obtenerTodas();

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, res.getBody().size());
    }

    @Test
    void obtenerPorIdDevuelveLaRecompensaDelServicio() {
        when(recompensaService.obtenerPorId(1L)).thenReturn(recompensa(1L, "Café gratis", 50));

        ResponseEntity<Recompensa> res = controller.obtenerPorId(1L);

        assertEquals(200, res.getStatusCode().value());
        assertEquals("Café gratis", res.getBody().getNombre());
    }

    @Test
    void crearConRolDistintoDeAdminLanzaAccessDeniedSinTocarElServicio() {
        Recompensa nueva = recompensa(null, "Postre gratis", 80);

        assertThrows(AccessDeniedException.class,
                () -> controller.crear(nueva, authAs("cliente@test.com", "ROLE_USER")));

        verifyNoInteractions(recompensaService);
    }

    @Test
    void crearConRolAdminCreaLaRecompensa() {
        Recompensa nueva = recompensa(null, "Postre gratis", 80);
        when(recompensaService.crear(nueva)).thenReturn(recompensa(1L, "Postre gratis", 80));

        ResponseEntity<Recompensa> res = controller.crear(nueva, authAs("admin@test.com", "ROLE_ADMIN"));

        assertEquals(201, res.getStatusCode().value());
        assertEquals(1L, res.getBody().getId());
    }

    @Test
    void actualizarConRolDistintoDeAdminLanzaAccessDeniedSinTocarElServicio() {
        Recompensa cambios = recompensa(1L, "Postre gratis", 100);

        assertThrows(AccessDeniedException.class,
                () -> controller.actualizar(1L, cambios, authAs("restaurante@test.com", "ROLE_RESTAURANT")));

        verifyNoInteractions(recompensaService);
    }

    @Test
    void actualizarConRolAdminActualizaLaRecompensa() {
        Recompensa cambios = recompensa(1L, "Postre gratis", 100);
        when(recompensaService.actualizar(eq(1L), eq(cambios))).thenReturn(recompensa(1L, "Postre gratis", 100));

        ResponseEntity<Recompensa> res = controller.actualizar(1L, cambios, authAs("admin@test.com", "ROLE_ADMIN"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(100, res.getBody().getPuntosNecesarios());
    }

    @Test
    void eliminarConRolDistintoDeAdminLanzaAccessDeniedSinTocarElServicio() {
        assertThrows(AccessDeniedException.class,
                () -> controller.eliminar(1L, authAs("cliente@test.com", "ROLE_USER")));

        verify(recompensaService, never()).eliminar(any());
    }

    @Test
    void eliminarConRolAdminEliminaLaRecompensa() {
        ResponseEntity<Void> res = controller.eliminar(1L, authAs("admin@test.com", "ROLE_ADMIN"));

        assertEquals(204, res.getStatusCode().value());
        verify(recompensaService).eliminar(1L);
    }

    @Test
    void canjearUsaSiempreElEmailAutenticadoNuncaUnoDelCuerpo() {
        ResponseEntity<?> res = controller.canjear(1L, authAs("cliente@test.com", "ROLE_USER"));

        assertEquals(200, res.getStatusCode().value());
        verify(recompensaService).canjearRecompensa(1L, "cliente@test.com");
    }
}
