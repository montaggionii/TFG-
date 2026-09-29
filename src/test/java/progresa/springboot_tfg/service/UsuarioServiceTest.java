package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.LoginRequestDTO;
import progresa.springboot_tfg.dto.LoginResponseDTO;
import progresa.springboot_tfg.dto.RegisterRequestDTO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura de UsuarioService centrada en la lógica de seguridad ya
 * auditada en AGENT_TASKS.md (FID-001: no enumerar emails vía el código de
 * error de login; requireOwner: un usuario nunca debe poder leer/modificar
 * los datos de otro), para que una regresión futura la detecte un test y
 * no una auditoría manual.
 */
@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private QrService qrService;

    private BCryptPasswordEncoder passwordEncoder;
    private UsuarioService usuarioService;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        usuarioService = new UsuarioService(usuarioDAO, passwordEncoder, jwtUtil, qrService);
    }

    private Usuario usuarioConPassword(String email, String rawPassword) {
        Usuario usuario = new Usuario();
        usuario.setId(1L);
        usuario.setNombre("Cliente Test");
        usuario.setEmail(email);
        usuario.setPassword(passwordEncoder.encode(rawPassword));
        usuario.setPuntos(0);
        usuario.setRole(Role.ROLE_USER);
        return usuario;
    }

    @Test
    void loginConCredencialesCorrectasDevuelveTokenYDatos() {
        Usuario usuario = usuarioConPassword("cliente@test.com", "password123");
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(jwtUtil.generateToken("cliente@test.com", "ROLE_USER")).thenReturn("jwt-falso");

        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setEmail("cliente@test.com");
        dto.setPassword("password123");

        LoginResponseDTO respuesta = usuarioService.login(dto);

        assertEquals("jwt-falso", respuesta.getToken());
        assertEquals("cliente@test.com", respuesta.getEmail());
    }

    @Test
    void loginConEmailInexistenteLanzaSecurityException() {
        when(usuarioDAO.findByEmail("nadie@test.com")).thenReturn(Optional.empty());

        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setEmail("nadie@test.com");
        dto.setPassword("cualquiera");

        SecurityException ex = assertThrows(SecurityException.class, () -> usuarioService.login(dto));
        assertEquals("Credenciales incorrectas", ex.getMessage());
    }

    @Test
    void loginConPasswordIncorrectaLanzaElMismoErrorQueEmailInexistente() {
        // FID-001: email inexistente y password incorrecta deben producir
        // exactamente el mismo mensaje/tipo de excepción, para no permitir
        // enumerar emails registrados comparando las respuestas.
        Usuario usuario = usuarioConPassword("cliente@test.com", "password123");
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));

        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setEmail("cliente@test.com");
        dto.setPassword("password-incorrecta");

        SecurityException ex = assertThrows(SecurityException.class, () -> usuarioService.login(dto));
        assertEquals("Credenciales incorrectas", ex.getMessage());
        verify(jwtUtil, never()).generateToken(any(), any());
    }

    @Test
    void registerConEmailYaExistenteLanzaDuplicateResourceException() {
        when(usuarioDAO.findByEmail("repetido@test.com"))
                .thenReturn(Optional.of(usuarioConPassword("repetido@test.com", "x")));

        RegisterRequestDTO dto = new RegisterRequestDTO();
        dto.setNombre("Otro");
        dto.setEmail("repetido@test.com");
        dto.setPassword("password123");

        assertThrows(DuplicateResourceException.class, () -> usuarioService.register(dto));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void obtenerPropioConElDuenoRealDevuelveLosDatos() {
        Usuario usuario = usuarioConPassword("dueno@test.com", "x");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        var resultado = usuarioService.obtenerPropio(1L, "dueno@test.com");

        assertEquals("dueno@test.com", resultado.getEmail());
    }

    @Test
    void obtenerPropioConUsuarioDistintoLanzaAccessDenied() {
        // Regresión directa de FID-005: acceder a datos de otro usuario
        // debe seguir denegado aunque el atacante esté autenticado con un
        // token válido de OTRA cuenta.
        Usuario usuario = usuarioConPassword("victima@test.com", "x");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(AccessDeniedException.class,
                () -> usuarioService.obtenerPropio(1L, "atacante@test.com"));
    }

    @Test
    void obtenerPropioConEmailAutenticadoNuloLanzaAccessDenied() {
        Usuario usuario = usuarioConPassword("dueno@test.com", "x");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(AccessDeniedException.class,
                () -> usuarioService.obtenerPropio(1L, null));
    }

    @Test
    void obtenerPropioConIdInexistenteLanzaResourceNotFound() {
        when(usuarioDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> usuarioService.obtenerPropio(99L, "cualquiera@test.com"));
    }

    @Test
    void eliminarPropioConUsuarioDistintoLanzaAccessDeniedYNoBorra() {
        Usuario usuario = usuarioConPassword("victima@test.com", "x");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(AccessDeniedException.class,
                () -> usuarioService.eliminarPropio(1L, "atacante@test.com"));
        verify(usuarioDAO, never()).delete(any());
    }

    @Test
    void changePasswordConUsuarioDistintoLanzaAccessDeniedYNoModifica() {
        Usuario usuario = usuarioConPassword("victima@test.com", "actual123");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(AccessDeniedException.class,
                () -> usuarioService.changePassword(1L, "actual123", "nuevaPassword1", "atacante@test.com"));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void changePasswordConPasswordActualIncorrectaLanzaSecurityException() {
        Usuario usuario = usuarioConPassword("dueno@test.com", "actual123");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(SecurityException.class,
                () -> usuarioService.changePassword(1L, "password-mala", "nuevaPassword1", "dueno@test.com"));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void changePasswordConNuevaPasswordDemasiadoCortaLanzaIllegalArgument() {
        Usuario usuario = usuarioConPassword("dueno@test.com", "actual123");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(IllegalArgumentException.class,
                () -> usuarioService.changePassword(1L, "actual123", "corta", "dueno@test.com"));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void changePasswordConDatosValidosActualizaLaPasswordCifrada() {
        Usuario usuario = usuarioConPassword("dueno@test.com", "actual123");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        usuarioService.changePassword(1L, "actual123", "nuevaPassword1", "dueno@test.com");

        assertTrue(passwordEncoder.matches("nuevaPassword1", usuario.getPassword()));
        assertFalse(passwordEncoder.matches("actual123", usuario.getPassword()));
        verify(usuarioDAO).save(usuario);
    }

    @Test
    void identificarPorQrConCodigoVacioLanzaResourceNotFoundSinConsultarBD() {
        assertThrows(ResourceNotFoundException.class, () -> usuarioService.identificarPorQr("  "));
        verify(usuarioDAO, never()).findByQrCode(any());
    }

    @Test
    void identificarPorQrConCodigoDesconocidoLanzaResourceNotFound() {
        when(usuarioDAO.findByQrCode("QR-INEXISTENTE")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> usuarioService.identificarPorQr("QR-INEXISTENTE"));
    }
}
