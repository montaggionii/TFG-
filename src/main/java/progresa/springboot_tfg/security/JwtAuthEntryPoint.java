package progresa.springboot_tfg.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Escribe la respuesta directamente en vez de usar response.sendError(): en
 * una app stateless sendError() dispara un forward interno a /error, que
 * vuelve a pasar por la cadena de seguridad sin contexto de autenticación
 * (ver JwtAccessDeniedHandler para el caso que esto rompía en la práctica).
 */
@Component
public class JwtAuthEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"status\":401,\"error\":\"Unauthorized\",\"message\":\"JWT inválido o no presente\"}"
        );
    }
}
