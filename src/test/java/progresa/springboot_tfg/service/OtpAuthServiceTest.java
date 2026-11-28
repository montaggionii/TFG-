package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.LoginResponseDTO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.security.JwtUtil;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Login con SMS/OTP (AGT-053: sin este flujo, Twilio sin configurar dejaba
 * entrar a cualquiera; aquí se cubre el flujo normal, nunca ejercitado por
 * ningún test unitario). Las cuentas creadas por teléfono no tienen
 * contraseña local real: el hash aleatorio que las protege debe pasar por
 * el mismo BCryptPasswordEncoder que usa el login por contraseña, igual
 * que UsuarioService.eliminarPropio, para no dejar un valor en claro en
 * la columna "password".
 */
@ExtendWith(MockitoExtension.class)
class OtpAuthServiceTest {

    @Mock
    private OtpService otpService;
    @Mock
    private UsuarioService usuarioService;
    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private QrService qrService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private OtpAuthService service;

    @BeforeEach
    void setUp() {
        service = new OtpAuthService(otpService, usuarioService, usuarioDAO, jwtUtil, qrService, passwordEncoder);
    }

    @Test
    void enviarCodigoConTelefonoInvalidoLanzaBadRequestSinLlamarAlOtpService() {
        assertThrows(BadRequestException.class, () -> service.enviarCodigo("123"));
        verifyNoInteractions(otpService);
    }

    @Test
    void enviarCodigoConTelefonoValidoDelegaEnOtpService() {
        when(otpService.enviar("+34600111222")).thenReturn("123456");

        var respuesta = service.enviarCodigo("+34600111222");

        assertTrue(respuesta.isEnviado());
        verify(otpService).enviar("+34600111222");
    }

    @Test
    void verificarYEntrarConTelefonoInvalidoLanzaBadRequestSinComprobarElCodigo() {
        assertThrows(BadRequestException.class, () -> service.verificarYEntrar("123", "123456", "Ana"));
        verifyNoInteractions(otpService);
    }

    @Test
    void verificarYEntrarConCodigoIncorrectoLanzaSecurityExceptionSinTocarElDao() {
        when(otpService.verificar("+34600111222", "000000")).thenReturn(false);

        assertThrows(SecurityException.class,
                () -> service.verificarYEntrar("+34600111222", "000000", "Ana"));
        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void verificarYEntrarConUsuarioYaExistenteNoCreaUnoNuevo() {
        Usuario existente = new Usuario();
        existente.setId(7L);
        existente.setNombre("Ana");
        existente.setEmail("sms.34600111222@fidelyfood.local");
        existente.setPuntos(50);
        existente.setRole(Role.ROLE_USER);

        when(otpService.verificar("+34600111222", "123456")).thenReturn(true);
        when(usuarioDAO.findByTelefono("+34600111222")).thenReturn(Optional.of(existente));
        when(jwtUtil.generateToken("sms.34600111222@fidelyfood.local", "ROLE_USER")).thenReturn("jwt-real");

        LoginResponseDTO respuesta = service.verificarYEntrar("+34600111222", "123456", "Nombre ignorado");

        assertEquals(7L, respuesta.getId());
        assertEquals(50, respuesta.getPuntos());
        assertEquals("jwt-real", respuesta.getToken());
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void verificarYEntrarConUsuarioNuevoLoCreaConPasswordHasheadaYQr() {
        when(otpService.verificar("+34600111222", "123456")).thenReturn(true);
        when(usuarioDAO.findByTelefono("+34600111222")).thenReturn(Optional.empty());
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            if (u.getId() == null) {
                u.setId(99L);
            }
            return u;
        });
        when(qrService.generarQrUnico(99L)).thenReturn("QR-99");
        when(jwtUtil.generateToken(anyString(), anyString())).thenReturn("jwt-nuevo");

        LoginResponseDTO respuesta = service.verificarYEntrar("+34600111222", "123456", "Carla Cliente");

        assertEquals("jwt-nuevo", respuesta.getToken());
        assertEquals(0, respuesta.getPuntos());

        ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioDAO, times(2)).save(captor.capture());
        Usuario guardado = captor.getValue();

        assertEquals("Carla Cliente", guardado.getNombre());
        assertEquals("sms.34600111222@fidelyfood.local", guardado.getEmail());
        assertEquals(Role.ROLE_USER, guardado.getRole());
        assertEquals("QR-99", guardado.getQrCode());

        // Regresión: antes se guardaba el valor aleatorio sin pasar por el
        // BCryptPasswordEncoder (Base64 en claro en la columna "password").
        assertTrue(guardado.getPassword().startsWith("$2a$") || guardado.getPassword().startsWith("$2b$"));
        assertFalse(passwordEncoder.matches("cualquier-password", guardado.getPassword()));
    }

    @Test
    void verificarYEntrarConUsuarioNuevoSinNombreUsaUnNombrePorDefecto() {
        when(otpService.verificar("+34600111222", "123456")).thenReturn(true);
        when(usuarioDAO.findByTelefono("+34600111222")).thenReturn(Optional.empty());
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            if (u.getId() == null) {
                u.setId(5L);
            }
            return u;
        });
        when(qrService.generarQrUnico(5L)).thenReturn("QR-5");
        when(jwtUtil.generateToken(anyString(), anyString())).thenReturn("jwt");

        LoginResponseDTO respuesta = service.verificarYEntrar("+34600111222", "123456", null);

        assertEquals("Cliente 1222", respuesta.getNombre());
    }
}
