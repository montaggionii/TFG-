package progresa.springboot_tfg.service;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jwt.proc.JWTClaimsSetVerifier;

import com.nimbusds.jose.proc.SimpleSecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.LoginResponseDTO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.SocialAuthNotConfiguredException;
import progresa.springboot_tfg.security.JwtUtil;

import java.io.IOException;
import java.text.ParseException;
import java.net.URL;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * "Continuar con Google" / "Continuar con Apple": el cliente móvil o web
 * obtiene un id_token del proveedor, el backend lo verifica contra el JWKS
 * público del proveedor (firma RS256, emisor, audiencia y caducidad) y
 * devuelve el JWT propio de la sesión. Si el cliente es nuevo se le da de
 * alta en el momento: cero fricción la primera vez.
 */
@Service
public class SocialAuthService {

    private static final Logger log = LoggerFactory.getLogger(SocialAuthService.class);
    private static final String GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final String APPLE_JWKS = "https://appleid.apple.com/auth/keys";
    private static final String GOOGLE_ISSUER = "https://accounts.google.com";
    private static final String APPLE_ISSUER = "https://appleid.apple.com";

    private final UsuarioDAO usuarioDAO;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder;

    @Value("${app.oauth.google.client-id:}")
    private String googleClientId;

    /** Servicios ID de web y bundle IDs de iOS admitidos, separados por coma. */
    @Value("${app.oauth.apple.client-ids:}")
    private String appleClientIds;

    public SocialAuthService(UsuarioDAO usuarioDAO, JwtUtil jwtUtil, BCryptPasswordEncoder passwordEncoder) {
        this.usuarioDAO = usuarioDAO;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponseDTO loginGoogle(String idToken, String nombreEnviado) {
        Set<String> audiences = clientIds(googleClientId);
        JWTClaimsSet claims = verificar(
                idToken, GOOGLE_JWKS, GOOGLE_ISSUER, audiences,
                "Google", "GOOGLE_CLIENT_ID");
        return provisionar(claims, nombreEnviado);
    }

    public LoginResponseDTO loginApple(String idToken, String nombreEnviado) {
        Set<String> audiences = clientIds(appleClientIds);
        JWTClaimsSet claims = verificar(
                idToken,
                APPLE_JWKS,
                APPLE_ISSUER,
                audiences,
                "Apple",
                "APPLE_CLIENT_IDS");
        return provisionar(claims, nombreEnviado);
    }

    private static Set<String> clientIds(String valor) {
        if (valor == null || valor.isBlank()) return Set.of();
        Set<String> ids = new HashSet<>(List.of(valor.split("\\s*,\\s*")));
        ids.remove("");
        return ids;
    }

    /**
     * Verifica firma (RS256 contra el JWKS del proveedor), emisor, audiencia
     * y caducidad (el processor de Nimbus valida la expiración por defecto).
     */
    private JWTClaimsSet verificar(String idToken, String jwksUrl, String issuer,
                                   Set<String> clientIds, String proveedor, String varConfig) {
        if (clientIds.isEmpty()) {
            throw new SocialAuthNotConfiguredException(
                    "El acceso con " + proveedor + " no está configurado en el servidor. "
                            + "Define " + varConfig + " con el Client ID del proveedor.");
        }
        if (idToken == null || idToken.isBlank()) {
            throw new SecurityException("Falta el id_token de " + proveedor);
        }
        try {
            DefaultJWTProcessor<SimpleSecurityContext> processor = new DefaultJWTProcessor<>();
            JWKSource<SimpleSecurityContext> keySource = new RemoteJWKSet<>(new URL(jwksUrl));
            processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keySource));
            // Emisor exacto y caducidad (exp) obligatoria; la audiencia se
            // valida después contra los Client IDs admitidos.
            processor.setJWTClaimsSetVerifier(new DefaultJWTClaimsVerifier<>(
                    new JWTClaimsSet.Builder().issuer(issuer).build(),
                    new HashSet<>(Set.of("exp"))));
            JWTClaimsSet claims = processor.process(SignedJWT.parse(idToken), null);

            String audience = claims.getAudience() == null || claims.getAudience().isEmpty()
                    ? null : claims.getAudience().get(0);
            if (audience == null || !clientIds.contains(audience)) {
                throw new SecurityException("Token de " + proveedor + " emitido para otra aplicación");
            }
            return claims;
        } catch (Exception e) {
            log.warn("id_token de {} rechazado: {}", proveedor, e.getMessage());
            throw new SecurityException("Token de " + proveedor + " inválido");
        }
    }

    /**
     * Busca al usuario por el email del token; si no existe lo crea
     * (ROLE_USER, QR incluido) y devuelve la sesión con el JWT propio.
     */
    private LoginResponseDTO provisionar(JWTClaimsSet claims, String nombreEnviado) {
        String email;
        try {
            email = claims.getStringClaim("email");
        } catch (java.text.ParseException e) {
            throw new SecurityException("El proveedor no devolvió un email verificable");
        }
        if (email == null || email.isBlank()) {
            throw new SecurityException("El proveedor no devolvió un email verificable");
        }
        if (!emailVerificado(claims)) {
            // Sin esta comprobación, cualquiera que controle una cuenta de Google/Apple con un
            // email_verified=false que coincida con el email de un cliente ya existente en
            // FidelyFood entraría directamente en SU cuenta (puntos, historial, etc.) solo con
            // "confirmar" ese email sin que el proveedor lo haya verificado de verdad.
            throw new SecurityException("El proveedor no ha verificado este email");
        }
        String emailFinal = email.trim().toLowerCase();

        // Apple entrega el nombre fuera del id_token y solo en el primer
        // alta; Google sí lo incluye en el token como claim "name".
        String nombreClaim;
        try {
            nombreClaim = claims.getStringClaim("name");
        } catch (java.text.ParseException e) {
            nombreClaim = null;
        }
        String nombre = Optional.ofNullable(nombreClaim)
                .filter(s -> !s.isBlank())
                .or(() -> Optional.ofNullable(nombreEnviado))
                .filter(s -> !s.isBlank())
                .orElse(emailFinal.substring(0, emailFinal.indexOf('@')));

        Usuario usuario = usuarioDAO.findByEmail(emailFinal).orElseGet(() -> {
            Usuario nuevo = new Usuario();
            nuevo.setNombre(nombre);
            nuevo.setEmail(emailFinal);
            // Cuentas sociales: sin contraseña local. Un intento de login por
            // contraseña no podrá colarse con un hash aleatorio.
            nuevo.setPassword(hashAleatorio());
            nuevo.setPuntos(0);
            nuevo.setRole(Role.ROLE_USER);
            return usuarioDAO.save(nuevo);
        });

        String token = jwtUtil.generateToken(usuario.getEmail(), usuario.getRole().name());
        return new LoginResponseDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                token
        );
    }

    /**
     * Google manda {@code email_verified} como booleano JSON; algunas versiones del SDK de
     * Apple lo mandan como el string "true"/"false". Cualquier otra forma (o ausencia del
     * claim) se trata como no verificado: mejor rechazar un login legítimo por error de
     * formato que confiar un email sin que el proveedor lo garantice.
     */
    private static boolean emailVerificado(JWTClaimsSet claims) {
        Object valor = claims.getClaim("email_verified");
        if (valor instanceof Boolean b) {
            return b;
        }
        if (valor instanceof String s) {
            return "true".equalsIgnoreCase(s);
        }
        return false;
    }

    private String hashAleatorio() {
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        // Mismo patrón que UsuarioService.eliminarPropio: el valor aleatorio se
        // pasa por el mismo BCryptPasswordEncoder que usa el login por contraseña,
        // nunca se guarda en claro en la columna "password".
        return passwordEncoder.encode(Base64.getEncoder().encodeToString(bytes));
    }
}
