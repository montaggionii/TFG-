package progresa.springboot_tfg.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Un JWT válido que no tiene el rol requerido para el recurso debe devolver
 * 403 (autenticado pero sin permiso), no 401 (no autenticado) — el frontend
 * distingue ambos casos: un 401 fuerza logout, un 403 no.
 *
 * Escribe la respuesta directamente en vez de usar response.sendError(): en
 * una app stateless sendError() dispara un forward interno a /error, que
 * vuelve a pasar por la cadena de seguridad sin contexto de autenticación y
 * acaba devolviendo 401 en su lugar, pisando este 403.
 */
@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":403,\"error\":\"Forbidden\",\"message\":\"No tienes permiso para acceder a este recurso\"}"
        );
    }
}
