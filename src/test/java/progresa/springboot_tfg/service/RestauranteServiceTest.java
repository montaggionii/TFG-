package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dto.RestauranteLoginRequestDTO;
import progresa.springboot_tfg.dto.RestauranteLoginResponseDTO;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura de RestauranteService centrada en la lógica de seguridad ya
 * auditada en AGENT_TASKS.md: FID-001 (no enumerar emails vía el código de
 * error de login) y, sobre todo, FID-005 — la vulnerabilidad real de
 * Broken Access Control encontrada en las estadísticas de restaurante
 * (`/stats` y `/stats-avanzadas` no comprobaban `requireOwner`). Estos
 * tests fijan ese comportamiento para que una regresión la detecte un
 * test, no una auditoría manual.
 */
@ExtendWith(MockitoExtension.class)
class RestauranteServiceTest {

    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;
    @Mock
    private PromocionDAO promocionDAO;

    private BCryptPasswordEncoder passwordEncoder;
    private RestauranteService restauranteService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        restauranteService = new RestauranteService(
                restauranteDAO, passwordEncoder, jwtUtil, movimientoPuntosDAO, promocionDAO);
    }

    private Restaurante restauranteConPassword(String email, String rawPassword) {
        Restaurante restaurante = new Restaurante();
        restaurante.setId(3L);
        restaurante.setNombre("Venezuela Food");
        restaurante.setEmail(email);
        restaurante.setPassword(passwordEncoder.encode(rawPassword));
        restaurante.setRole(Role.ROLE_RESTAURANT);
        return restaurante;
    }

    @Test
    void loginConCredencialesCorrectasDevuelveTokenYDatos() {
        Restaurante restaurante = restauranteConPassword("restaurante@test.com", "password123");
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.of(restaurante));
        when(jwtUtil.generateToken("restaurante@test.com", "ROLE_RESTAURANT")).thenReturn("jwt-falso");

        RestauranteLoginRequestDTO dto = new RestauranteLoginRequestDTO();
        dto.setEmail("restaurante@test.com");
        dto.setPassword("password123");

        RestauranteLoginResponseDTO respuesta = restauranteService.login(dto);

        assertEquals("jwt-falso", respuesta.getToken());
        assertEquals("restaurante@test.com", respuesta.getEmail());
    }

    @Test
    void loginConEmailInexistenteLanzaSecurityException() {
        when(restauranteDAO.findByEmail("nadie@test.com")).thenReturn(Optional.empty());

        RestauranteLoginRequestDTO dto = new RestauranteLoginRequestDTO();
        dto.setEmail("nadie@test.com");
        dto.setPassword("cualquiera");

        SecurityException ex = assertThrows(SecurityException.class, () -> restauranteService.login(dto));
        assertEquals("Credenciales incorrectas", ex.getMessage());
    }

    @Test
    void loginConPasswordIncorrectaLanzaElMismoErrorQueEmailInexistente() {
        Restaurante restaurante = restauranteConPassword("restaurante@test.com", "password123");
        when(restauranteDAO.findByEmail("restaurante@test.com")).thenReturn(Optional.of(restaurante));

        RestauranteLoginRequestDTO dto = new RestauranteLoginRequestDTO();
        dto.setEmail("restaurante@test.com");
        dto.setPassword("password-incorrecta");

        SecurityException ex = assertThrows(SecurityException.class, () -> restauranteService.login(dto));
        assertEquals("Credenciales incorrectas", ex.getMessage());
        verify(jwtUtil, never()).generateToken(any(), any());
    }

    @Test
    void obtenerStatsConElDuenoRealDevuelveLosDatos() {
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));
        when(movimientoPuntosDAO.findByRestauranteId(3L)).thenReturn(Collections.emptyList());
        when(promocionDAO.findByRestauranteId(3L)).thenReturn(Collections.emptyList());

        var stats = restauranteService.obtenerStats(3L, "venezuelafood@test.com");

        assertNotNull(stats);
        assertEquals(0, stats.getPuntosOtorgados());
    }

    @Test
    void obtenerStatsConClienteAjenoLanzaAccessDenied() {
        // Regresión directa de FID-005: un token válido de OTRO restaurante
        // (o de un cliente cualquiera) nunca debe poder leer las
        // estadísticas de facturación/puntos de un restaurante ajeno.
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));

        assertThrows(AccessDeniedException.class,
                () -> restauranteService.obtenerStats(3L, "otro-restaurante@test.com"));
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void obtenerStatsAvanzadasConClienteAjenoLanzaAccessDenied() {
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));

        assertThrows(AccessDeniedException.class,
                () -> restauranteService.obtenerStatsAvanzadas(3L, "cliente-atacante@test.com"));
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void obtenerStatsConEmailAutenticadoNuloLanzaAccessDenied() {
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));

        assertThrows(AccessDeniedException.class,
                () -> restauranteService.obtenerStats(3L, null));
    }

    @Test
    void obtenerStatsConIdInexistenteLanzaResourceNotFound() {
        when(restauranteDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> restauranteService.obtenerStats(99L, "cualquiera@test.com"));
    }

    @Test
    void eliminarPropioConRestauranteDistintoLanzaAccessDeniedYNoBorra() {
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));

        assertThrows(AccessDeniedException.class,
                () -> restauranteService.eliminarPropio(3L, "otro-restaurante@test.com"));
        verify(restauranteDAO, never()).delete(any());
    }

    @Test
    void actualizarConEmailAutenticadoDeOtroRestauranteLanzaAccessDenied() {
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));

        Restaurante cambios = new Restaurante();
        cambios.setNombre("Nombre hackeado");

        assertThrows(AccessDeniedException.class,
                () -> restauranteService.actualizar(3L, cambios, "otro-restaurante@test.com"));
        verify(restauranteDAO, never()).save(any());
    }

    @Test
    void actualizarSinEmailAutenticadoNoComprueaPropiedad() {
        // Sobrecarga usada solo por el panel de administración (AdminController),
        // que ya exige ROLE_ADMIN a nivel de SecurityConfig antes de llegar aquí.
        Restaurante restaurante = restauranteConPassword("venezuelafood@test.com", "x");
        when(restauranteDAO.findById(3L)).thenReturn(Optional.of(restaurante));
        when(restauranteDAO.save(any(Restaurante.class))).thenAnswer(inv -> inv.getArgument(0));

        Restaurante cambios = new Restaurante();
        cambios.setNombre("Nuevo nombre");
        cambios.setEmail("venezuelafood@test.com");
        cambios.setDireccion("Calle Falsa 123");
        cambios.setCiudad("Valencia");
        cambios.setTelefono("600000000");

        Restaurante actualizado = restauranteService.actualizar(3L, cambios);

        assertEquals("Nuevo nombre", actualizado.getNombre());
    }
}
