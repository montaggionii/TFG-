package progresa.springboot_tfg.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static String email(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("Autenticación requerida");
        }
        return authentication.getName();
    }

    /**
     * Para rutas que caen bajo un permitAll de catálogo (modo invitado) pero cuyo
     * contenido no debe verse sin sesión real: un invitado llega aquí con un
     * AnonymousAuthenticationToken (nunca null), así que email(authentication) no
     * basta para rechazarlo.
     */
    public static void requireAuthenticated(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("Autenticación requerida");
        }
    }

    public static boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> role.equals(authority.getAuthority()));
    }

    public static void requireRole(Authentication authentication, String role) {
        if (!hasRole(authentication, role)) {
            throw new AccessDeniedException("No tienes permisos para realizar esta acción");
        }
    }
}
