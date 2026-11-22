package progresa.springboot_tfg.service;

import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.LoginResponseDTO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.SocialAuthNotConfiguredException;
import progresa.springboot_tfg.security.JwtUtil;


import java.util.Date;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(org.mockito.junit.jupiter.MockitoExtension.class)
class SocialAuthServiceTest {

    @Mock
    private UsuarioDAO usuarioDAO;

    @Mock
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new SocialAuthService(usuarioDAO, jwtUtil, passwordEncoder);
    }

    private SocialAuthService service;

    private JWTClaimsSet claimsGoogle(String email, String name) {
        return new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience("google-client-id")
                .claim("email", email)
                .claim("email_verified", true)
                .claim("name", name)
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();
    }

    @Test
    void loginGoogleSinClientConfiguradoLanzaNotConfigured() {
        assertThrows(SocialAuthNotConfiguredException.class,
                () -> service.loginGoogle("token-cualquiera", null));
    }

    @Test
    void loginAppleSinClientConfiguradoLanzaNotConfigured() {
        assertThrows(SocialAuthNotConfiguredException.class,
                () -> service.loginApple("token-cualquiera", null));
    }

    @Test
    void loginGoogleSinTokenLanzaSecurityException() {
        ReflectionTestUtils.setField(service, "googleClientId", "google-client-id");
        assertThrows(SecurityException.class, () -> service.loginGoogle(null, null));
    }

    @Test
    void provisionarCreaUsuarioNuevoConQrYPersona() throws Exception {
        // Accedemos a la lógica de alta automática a través de la
        // verificación falsificando las claims: usamosReflectionTestUtils
        // sobre el método privado vía un token que pasa la verificación no
        // es viable offline, así que probamos el comportamiento del alta
        // con el propio DAO.
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience("google-client-id")
                .claim("email", "nuevo.social@gmail.com")
                .claim("email_verified", true)
                .claim("name", "Ana Social")
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();

        ReflectionTestUtils.setField(service, "googleClientId", "google-client-id");
        when(usuarioDAO.findByEmail("nuevo.social@gmail.com")).thenReturn(Optional.empty());
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtUtil.generateToken(any(), any())).thenReturn("jwt");

        // El id_token real no se puede fabricar sin las claves privadas de
        // Google; la provisión se ejercita vía reflexión del método privado.
        var provisionar = SocialAuthService.class.getDeclaredMethod("provisionar", JWTClaimsSet.class, String.class);
        provisionar.setAccessible(true);
        LoginResponseDTO respuesta = (LoginResponseDTO) provisionar.invoke(service, claims, null);

        assertEquals("nuevo.social@gmail.com", respuesta.getEmail());
        assertEquals("Ana Social", respuesta.getNombre());
        assertEquals("jwt", respuesta.getToken());

        // Regresión: la cuenta social sin contraseña local debía guardar el
        // valor aleatorio en claro (Base64) en vez de con el mismo
        // BCryptPasswordEncoder que usa el login por contraseña real.
        org.mockito.ArgumentCaptor<Usuario> captor = org.mockito.ArgumentCaptor.forClass(Usuario.class);
        org.mockito.Mockito.verify(usuarioDAO).save(captor.capture());
        assertTrue(!passwordEncoder.matches("cualquier-otra-cosa", captor.getValue().getPassword()));
        assertTrue(captor.getValue().getPassword().startsWith("$2a$") || captor.getValue().getPassword().startsWith("$2b$"));
    }

    @Test
    void provisionarUsaElNombreEnviadoCuandoAppleNoLoIncluye() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://appleid.apple.com")
                .audience("fidelyfood.web")
                .claim("email", "ana@privaterelay.appleid.com")
                // Apple manda este claim como string "true"/"false", no como booleano JSON.
                .claim("email_verified", "true")
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();

        when(usuarioDAO.findByEmail("ana@privaterelay.appleid.com")).thenReturn(Optional.empty());
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> {
            Usuario u = inv.getArgument(0);
            // El seeder de QR no corre en unitarios; simulamos que ya quedó guardado
            u.setRole(Role.ROLE_USER);
            return u;
        });
        when(jwtUtil.generateToken(any(), any())).thenReturn("jwt");

        var provisionar = SocialAuthService.class.getDeclaredMethod("provisionar", JWTClaimsSet.class, String.class);
        provisionar.setAccessible(true);
        LoginResponseDTO respuesta = (LoginResponseDTO) provisionar.invoke(service, claims, "Ana Apple");

        assertEquals("Ana Apple", respuesta.getNombre());
        assertTrue(respuesta.getToken() != null && !respuesta.getToken().isBlank());
    }

    /**
     * Regresión de seguridad: sin esta comprobación, alguien que controle una cuenta de
     * Google con email_verified=false (p. ej. un dominio de Workspace sin verificar) podría
     * "confirmar" el email de un cliente real de FidelyFood y entrar directamente en su
     * cuenta ya existente (puntos, historial) solo con un id_token firmado por Google, sin
     * haber probado nunca ser el dueño real de ese email.
     */
    @Test
    void provisionarRechazaEmailNoVerificadoDeGoogleSinTocarElDao() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience("google-client-id")
                .claim("email", "victima@test.com")
                .claim("email_verified", false)
                .claim("name", "Atacante")
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();

        var provisionar = SocialAuthService.class.getDeclaredMethod("provisionar", JWTClaimsSet.class, String.class);
        provisionar.setAccessible(true);
        Exception ex = assertThrows(Exception.class, () -> provisionar.invoke(service, claims, null));
        assertTrue(ex.getCause() instanceof SecurityException);
        org.mockito.Mockito.verifyNoInteractions(usuarioDAO);
    }

    @Test
    void provisionarRechazaEmailNoVerificadoDeAppleComoString() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://appleid.apple.com")
                .audience("fidelyfood.web")
                .claim("email", "victima@test.com")
                .claim("email_verified", "false")
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();

        var provisionar = SocialAuthService.class.getDeclaredMethod("provisionar", JWTClaimsSet.class, String.class);
        provisionar.setAccessible(true);
        Exception ex = assertThrows(Exception.class, () -> provisionar.invoke(service, claims, null));
        assertTrue(ex.getCause() instanceof SecurityException);
        org.mockito.Mockito.verifyNoInteractions(usuarioDAO);
    }

    @Test
    void provisionarRechazaCuandoFaltaElClaimEmailVerified() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience("google-client-id")
                .claim("email", "victima@test.com")
                .claim("name", "Atacante")
                .expirationTime(new Date(System.currentTimeMillis() + 300_000))
                .build();

        var provisionar = SocialAuthService.class.getDeclaredMethod("provisionar", JWTClaimsSet.class, String.class);
        provisionar.setAccessible(true);
        Exception ex = assertThrows(Exception.class, () -> provisionar.invoke(service, claims, null));
        assertTrue(ex.getCause() instanceof SecurityException);
        org.mockito.Mockito.verifyNoInteractions(usuarioDAO);
    }
}
