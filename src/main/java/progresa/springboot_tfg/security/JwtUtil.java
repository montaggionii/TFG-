package progresa.springboot_tfg.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private static final long EXPIRATION_TIME = 1000 * 60 * 60 * 10; // 10 horas
    private static final String DEV_DEFAULT_SECRET = "fidelyfood-dev-jwt-secret-change-me-2026";

    @Value("${app.jwt.secret:" + DEV_DEFAULT_SECRET + "}")
    private String secret;

    @Value("${spring.profiles.active:}")
    private String activeProfile;

    private Key key;

    @PostConstruct
    public void validateSecret() {
        boolean isProd = activeProfile != null && activeProfile.toLowerCase().contains("prod");
        if (isProd && DEV_DEFAULT_SECRET.equals(secret)) {
            throw new IllegalStateException(
                    "APP_JWT_SECRET no está configurado en producción (perfil 'prod' activo). " +
                    "Define la variable de entorno APP_JWT_SECRET con un secreto fuerte antes de arrancar."
            );
        }
    }

    private Key getKey() {
        if (key == null) {
            key = Keys.hmacShaKeyFor(secret.getBytes());
        }
        return key;
    }

    public String generateToken(String email, String role) {

        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(getKey())
                .compact();
    }

    public Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String getEmail(String token) {
        return getClaims(token).getSubject();
    }

    public String getRole(String token) {
        return getClaims(token).get("role", String.class);
    }
}
