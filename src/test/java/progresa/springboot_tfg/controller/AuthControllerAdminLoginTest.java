package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import progresa.springboot_tfg.dto.LoginRequestDTO;
import progresa.springboot_tfg.security.JwtUtil;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.service.UsuarioService;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-008 — el login de admin no debe aceptar ninguna contraseña por defecto: sin
 * FIDELYFOOD_ADMIN_PASSWORD no hay cuenta admin utilizable. Sin Spring ni BD.
 */
class AuthControllerAdminLoginTest {

    private final JwtUtil jwtUtil = mock(JwtUtil.class);

    private AuthController controller(String adminPassword) {
        return new AuthController(mock(UsuarioService.class), mock(RestauranteService.class), jwtUtil, adminPassword);
    }

    private LoginRequestDTO request(String email, String password) {
        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setEmail(email);
        dto.setPassword(password);
        return dto;
    }

    @Test
    void conPasswordConfiguradaYCorrectaDevuelveTokenAdmin() {
        when(jwtUtil.generateToken("admin@fidelyfood.local", "ROLE_ADMIN")).thenReturn("tok");

        ResponseEntity<?> res = controller("s3cret-test").loginAdmin(request("admin@fidelyfood.local", "s3cret-test"));

        assertEquals(200, res.getStatusCode().value());
        assertEquals("tok", ((Map<?, ?>) res.getBody()).get("token"));
    }

    @Test
    void conPasswordConfiguradaUnaIncorrectaDevuelve401() {
        ResponseEntity<?> res = controller("s3cret-test").loginAdmin(request("admin@fidelyfood.local", "otra"));

        assertEquals(401, res.getStatusCode().value());
        verify(jwtUtil, never()).generateToken(anyString(), anyString());
    }

    @Test
    void sinVariableConfiguradaRechazaLaAntiguaPasswordPorDefecto() {
        ResponseEntity<?> res = controller("").loginAdmin(request("admin@fidelyfood.local", "admin123"));

        assertEquals(401, res.getStatusCode().value());
        verify(jwtUtil, never()).generateToken(anyString(), anyString());
    }

    @Test
    void sinVariableConfiguradaRechazaPasswordVaciaONula() {
        AuthController c = controller(null);

        assertEquals(401, c.loginAdmin(request("admin@fidelyfood.local", "")).getStatusCode().value());
        assertEquals(401, c.loginAdmin(request("admin@fidelyfood.local", null)).getStatusCode().value());
        assertNotNull(c);
    }

    @Test
    void emailQueNoEsAdminDevuelve401AunqueLaPasswordCoincida() {
        ResponseEntity<?> res = controller("s3cret-test").loginAdmin(request("otro@fidelyfood.local", "s3cret-test"));

        assertEquals(401, res.getStatusCode().value());
    }
}
