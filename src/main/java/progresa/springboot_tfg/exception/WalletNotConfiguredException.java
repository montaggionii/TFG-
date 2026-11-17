package progresa.springboot_tfg.exception;

/**
 * Se lanza cuando un cliente intenta descargar su pase de Apple Wallet
 * sin que el servidor tenga configurado el certificado de firma
 * (variables APP_WALLET_*). Responde 503 con instrucciones para el operador.
 */
public class WalletNotConfiguredException extends RuntimeException {

    public WalletNotConfiguredException(String message) {
        super(message);
    }
}
