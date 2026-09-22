package progresa.springboot_tfg.security;

import org.springframework.security.access.AccessDeniedException;
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
