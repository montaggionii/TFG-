package progresa.springboot_tfg.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * requireAuthenticated nació de una fuga real (AGT-054): una ruta cae bajo un
 * permitAll de catálogo (modo invitado) pero su contenido no debe verse sin
 * sesión. Con el modo invitado activo, un invitado llega con un
 * AnonymousAuthenticationToken, nunca null, así que email(authentication) no
 * lo detecta.
 */
class SecurityUtilsTest {

    @Test
    void requireAuthenticatedConNullLanzaAccessDenied() {
        assertThrows(AccessDeniedException.class, () -> SecurityUtils.requireAuthenticated(null));
    }

    @Test
    void requireAuthenticatedConTokenAnonimoLanzaAccessDenied() {
        Authentication anonimo = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        assertThrows(AccessDeniedException.class, () -> SecurityUtils.requireAuthenticated(anonimo));
    }

    @Test
    void requireAuthenticatedConTokenNoAutenticadoLanzaAccessDenied() {
        UsernamePasswordAuthenticationToken sinAutenticar =
                new UsernamePasswordAuthenticationToken("cliente@test.com", "N/A");
        sinAutenticar.setAuthenticated(false);

        assertThrows(AccessDeniedException.class, () -> SecurityUtils.requireAuthenticated(sinAutenticar));
    }

    @Test
    void requireAuthenticatedConUsuarioRealNoLanzaNada() {
        Authentication real = new UsernamePasswordAuthenticationToken(
                "cliente@test.com", "N/A", List.of(new SimpleGrantedAuthority("ROLE_USER")));

        assertDoesNotThrow(() -> SecurityUtils.requireAuthenticated(real));
    }
}
