package progresa.springboot_tfg.exception;

/**
 * Se lanza cuando alguien intenta entrar con Google/Apple sin que el
 * servidor tenga configurado el Client ID del proveedor
 * (GOOGLE_CLIENT_ID / APPLE_CLIENT_IDS). Responde 503 con instrucciones.
 */
public class SocialAuthNotConfiguredException extends RuntimeException {

    public SocialAuthNotConfiguredException(String message) {
        super(message);
    }
}
