package progresa.springboot_tfg.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * Frena a fuerza bruta en los endpoints de login. Solo actúa sobre
 * /api/auth/login, /login-restaurante y /login-admin; el resto de
 * peticiones pasa sin coste. Lee el email del cuerpo de la petición para
 * usar (IP + email) como clave del límite — ver LoginRateLimiter para el
 * porqué de esa elección.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LOGIN_PATHS = Set.of(
            "/api/auth/login", "/api/auth/login-restaurante", "/api/auth/login-admin"
    );

    private final LoginRateLimiter rateLimiter;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LoginRateLimitFilter(LoginRateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equalsIgnoreCase(request.getMethod()) && LOGIN_PATHS.contains(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        byte[] body = request.getInputStream().readAllBytes();
        String email = extractEmail(body);
        String key = request.getRemoteAddr() + "|" + email;

        if (rateLimiter.isBlocked(key)) {
            writeTooManyRequests(response);
            return;
        }

        CachedBodyHttpServletRequest wrappedRequest = new CachedBodyHttpServletRequest(request, body);
        chain.doFilter(wrappedRequest, response);

        if (response.getStatus() >= 400) {
            rateLimiter.recordFailure(key);
        } else if (response.getStatus() < 300) {
            rateLimiter.recordSuccess(key);
        }
    }

    private String extractEmail(byte[] body) {
        try {
            JsonNode node = objectMapper.readTree(body);
            String email = node.path("email").asText("");
            return email.trim().toLowerCase();
        } catch (IOException e) {
            return "";
        }
    }

    private void writeTooManyRequests(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", "60");
        response.setContentType("application/json");
        response.getWriter().write(String.format(
                "{\"timestamp\":\"%s\",\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.\"}",
                LocalDateTime.now()
        ));
    }

    /** Permite volver a leer el body ya consumido para extraer el email. */
    private static class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyHttpServletRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return byteArrayInputStream.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener readListener) {
                }

                @Override
                public int read() {
                    return byteArrayInputStream.read();
                }
            };
        }

        @Override
        public java.io.BufferedReader getReader() {
            return new java.io.BufferedReader(
                    new java.io.InputStreamReader(getInputStream(), StandardCharsets.UTF_8)
            );
        }
    }
}
