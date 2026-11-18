package progresa.springboot_tfg.service;

import de.brendamour.jpasskit.PKField;
import de.brendamour.jpasskit.PKBarcode;
import de.brendamour.jpasskit.PKPass;
import de.brendamour.jpasskit.PKPassBuilder;
import de.brendamour.jpasskit.enums.PKBarcodeFormat;
import de.brendamour.jpasskit.enums.PKPassType;
import de.brendamour.jpasskit.passes.PKGenericPassBuilder;
import de.brendamour.jpasskit.passes.PKStoreCard;
import de.brendamour.jpasskit.signing.PKInMemorySigningUtil;
import de.brendamour.jpasskit.signing.PKPassTemplateInMemory;
import de.brendamour.jpasskit.signing.PKSigningException;
import de.brendamour.jpasskit.signing.PKSigningInformation;
import de.brendamour.jpasskit.signing.PKSigningInformationUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.exception.WalletNotConfiguredException;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Genera el pase de lealtad de Apple Wallet (.pkpass) del cliente:
 * tarjeta de tienda con el saldo de puntos, el nombre y el QR que el
 * restaurante escanea al registrar la compra.
 *
 * La firma requiere un Pass Type ID de Apple (variables APP_WALLET_*).
 * El certificado intermedio WWDR de Apple (G6) va empaquetado en
 * resources/wallet. Sin certificado configurado, el pase se construye
 * igualmente (útil para pruebas), pero {@link #generarPkpass(Usuario)}
 * lanza {@link WalletNotConfiguredException} porque un .pkpass sin firmar
 * no es válido para Wallet.
 */
@Service
public class WalletPassService {

    private static final Logger log = LoggerFactory.getLogger(WalletPassService.class);
    private static final String WWDR_RESOURCE = "wallet/AppleWWDRCAG6.cer";

    private final UsuarioDAO usuarioDAO;

    @Value("${app.wallet.team-id:}")
    private String teamId;

    @Value("${app.wallet.pass-type-id:}")
    private String passTypeId;

    @Value("${app.wallet.cert-path:}")
    private String certPath;

    @Value("${app.wallet.cert-password:}")
    private String certPassword;

    public WalletPassService(UsuarioDAO usuarioDAO) {
        this.usuarioDAO = usuarioDAO;
    }

    /**
     * Genera el .pkpass firmado y listo para "Añadir a Apple Wallet".
     */
    public byte[] generarPkpass(Usuario usuario) {
        if (vacio(teamId) || vacio(passTypeId) || vacio(certPath)) {
            throw new WalletNotConfiguredException(
                    "La descarga del pase de Wallet no está configurada en el servidor. "
                            + "Define APP_WALLET_TEAM_ID, APP_WALLET_PASS_TYPE_ID, APP_WALLET_CERT_PATH "
                            + "(certificado .p12 de Pass Type ID) y APP_WALLET_CERT_PASSWORD.");
        }

        PKPass pass = construirPkPass(usuario);

        PKSigningInformation signingInfo;
        try (InputStream wwdr = new ClassPathResource(WWDR_RESOURCE).getInputStream()) {
            signingInfo = new PKSigningInformationUtil()
                    .loadSigningInformationFromPKCS12AndIntermediateCertificate(
                            new FileInputStream(certPath), certPassword, wwdr);
        } catch (Exception e) {
            log.error("No se pudo cargar el certificado de Wallet desde {}: {}", certPath, e.getMessage());
            throw new WalletNotConfiguredException(
                    "El certificado de Wallet del servidor no es válido. Revisa APP_WALLET_CERT_PATH y APP_WALLET_CERT_PASSWORD.");
        }

        try {
            PKPassTemplateInMemory template = new PKPassTemplateInMemory();
            addResource(template, "icon.png");
            addResource(template, "icon@2x.png");
            addResource(template, "icon@3x.png");
            addResource(template, "logo.png");

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            return new PKInMemorySigningUtil().createSignedAndZippedPkPassArchive(pass, template, signingInfo);
        } catch (PKSigningException | IOException e) {
            throw new IllegalStateException("No se pudo firmar el pase de Wallet: " + e.getMessage(), e);
        }
    }

    /**
     * Carga el usuario autenticado por email y valida que sea un cliente
     * (solo ROLE_USER tiene QR de fidelización).
     */
    public Usuario obtenerCliente(String emailAutenticado) {
        Usuario usuario = usuarioDAO.findByEmail(emailAutenticado)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        if (usuario.getRole() != Role.ROLE_USER) {
            throw new BadRequestException("Solo los clientes tienen pase de fidelización en Wallet");
        }
        return usuario;
    }

    /**
     * Construye la estructura del pase (tarjeta de tienda) sin firmar.
     * Visible para pruebas: no depende del certificado.
     */
    public PKPass construirPkPass(Usuario usuario) {
        PKGenericPassBuilder tarjeta = PKStoreCard.builder()
                .passType(PKPassType.PKStoreCard)
                .primaryFieldBuilder(PKField.builder()
                        .key("saldo")
                        .label("PUNTOS")
                        .value(usuario.getPuntos()))
                .secondaryFieldBuilder(PKField.builder()
                        .key("miembro")
                        .label("MIEMBRO")
                        .value(usuario.getNombre()));

        return PKPass.builder()
                .passTypeIdentifier(vacio(passTypeId) ? "pass.progresa.fidelyfood.dev" : passTypeId)
                .teamIdentifier(vacio(teamId) ? "DEVELOPMENT" : teamId)
                .formatVersion(1)
                .organizationName("FidelyFood")
                .description("Tarjeta de fidelización de FidelyFood")
                .serialNumber(usuario.getQrCode())
                .backgroundColor("rgb(255, 105, 65)")
                .foregroundColor("rgb(255, 255, 255)")
                .labelColor("rgb(255, 245, 235)")
                .logoText("FidelyFood")
                .barcodeBuilder(PKBarcode.builder()
                        .format(PKBarcodeFormat.PKBarcodeFormatQR)
                        .message(usuario.getQrCode())
                        .messageEncoding(StandardCharsets.UTF_8))
                .pass(tarjeta)
                .build();
    }

    private static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    private void addResource(PKPassTemplateInMemory template, String name) throws IOException {
        try (InputStream in = new ClassPathResource("wallet/" + name).getInputStream()) {
            template.addFile(name, in);
        }
    }
}
