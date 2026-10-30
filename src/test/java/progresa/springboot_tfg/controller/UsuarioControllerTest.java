package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dto.UsuarioDTO;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.service.UsuarioService;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * AGT-035 — UsuarioController no tenía ningún test propio. identificarQr
 * comprueba ROLE_RESTAURANT directamente en el controlador
 * (SecurityUtils.requireRole), no delegado a un servicio — UsuarioService.
 * identificarPorQr no tiene ninguna comprobación de rol propia — mismo
 * patrón ya cubierto en PuntosController (AGT-020), PromocionController
 * (AGT-022) y RecompensaController (AGT-033). SecurityConfig ya exige
 * ROLE_RESTAURANT en POST /api/usuarios/identificar-qr a nivel de filtro,
 * así que esto es defensa en profundidad, no una vulnerabilidad real — pero
 * sin un test que lo fije, una regresión que borrase esa llamada pasaría
 * los tests de UsuarioService (que no la ejercitan) sin que nada se diera
 * cuenta.
 */
@ExtendWith(MockitoExtension.class)
class UsuarioControllerTest {

    @Mock
    private UsuarioService usuarioService;

    private UsuarioController controller;

    @BeforeEach
    void setUp() {
        controller = new UsuarioController(usuarioService);
    }

    private Authentication authAs(String email, String role) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority(role)));
    }

    private UsuarioDTO usuarioDTO(Long id, String nombre, String email, int puntos) {
        return new UsuarioDTO(id, nombre, email, puntos);
    }

    @Test
    void obtenerTodosDevuelveLosUsuariosDelServicio() {
        when(usuarioService.obtenerTodos()).thenReturn(List.of(usuarioDTO(1L, "Ana", "ana@test.com", 50)));

        ResponseEntity<List<UsuarioDTO>> res = controller.obtenerTodos();

        assertEquals(200, res.getStatusCode().value());
        assertEquals(1, res.getBody().size());
    }

    @Test
    void obtenerPorIdDelegaEnObtenerPropioConElEmailAutenticado() {
        when(usuarioService.obtenerPropio(1L, "ana@test.com")).thenReturn(usuarioDTO(1L, "Ana", "ana@test.com", 50));

        ResponseEntity<UsuarioDTO> res = controller.obtenerPorId(1L, authAs("ana@test.com", "ROLE_USER"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("Ana", res.getBody().getNombre());
        verify(usuarioService).obtenerPropio(1L, "ana@test.com");
    }

    @Test
    void actualizarDelegaConElEmailAutenticadoNuncaUnoDelCuerpo() {
        Usuario cambios = new Usuario();
        cambios.setNombre("Ana Nueva");
        when(usuarioService.actualizar(eq(1L), eq(cambios), eq("ana@test.com")))
                .thenReturn(usuarioDTO(1L, "Ana Nueva", "ana@test.com", 50));

        ResponseEntity<UsuarioDTO> res = controller.actualizar(1L, cambios, authAs("ana@test.com", "ROLE_USER"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("Ana Nueva", res.getBody().getNombre());
        verify(usuarioService).actualizar(1L, cambios, "ana@test.com");
    }

    @Test
    void eliminarDelegaEnEliminarPropioConElEmailAutenticado() {
        ResponseEntity<Void> res = controller.eliminar(1L, authAs("ana@test.com", "ROLE_USER"));

        assertEquals(204, res.getStatusCode().value());
        verify(usuarioService).eliminarPropio(1L, "ana@test.com");
    }

    @Test
    void cambiarPasswordDelegaConLosCamposDelBodyYElEmailAutenticado() {
        ResponseEntity<Void> res = controller.cambiarPassword(
                1L,
                Map.of("currentPassword", "actual123", "newPassword", "nueva456"),
                authAs("ana@test.com", "ROLE_USER"));

        assertEquals(204, res.getStatusCode().value());
        verify(usuarioService).changePassword(1L, "actual123", "nueva456", "ana@test.com");
    }

    @Test
    void subirFotoDelegaConElEmailAutenticadoYDevuelveLaRutaDelServicio() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "foto.jpg", "image/jpeg", new byte[]{1, 2, 3});
        when(usuarioService.subirFoto(1L, file, "ana@test.com")).thenReturn("/uploads/foto.jpg");

        ResponseEntity<String> res = controller.subirFoto(1L, file, authAs("ana@test.com", "ROLE_USER"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("/uploads/foto.jpg", res.getBody());
    }

    @Test
    void identificarQrConRolDistintoDeRestauranteLanzaAccessDeniedSinTocarElServicio() {
        assertThrows(AccessDeniedException.class,
                () -> controller.identificarQr(Map.of("qr", "USER_1_abc"), authAs("ana@test.com", "ROLE_USER")));

        verifyNoInteractions(usuarioService);
    }

    @Test
    void identificarQrConRolRestauranteDelegaEnElServicio() {
        when(usuarioService.identificarPorQr("USER_1_abc")).thenReturn(usuarioDTO(1L, "Ana", "ana@test.com", 50));

        ResponseEntity<UsuarioDTO> res = controller.identificarQr(
                Map.of("qr", "USER_1_abc"), authAs("restaurante@test.com", "ROLE_RESTAURANT"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("Ana", res.getBody().getNombre());
        verify(usuarioService).identificarPorQr("USER_1_abc");
    }
}
