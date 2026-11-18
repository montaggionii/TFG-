package progresa.springboot_tfg.controller;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.WalletPassService;

/**
 * Descarga del pase de Apple Wallet del cliente autenticado.
 * El .pkpass se abre con Safari/App Store y Wallet lo ofrece como
 * "Añadir a Apple Wallet".
 */
@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final WalletPassService walletPassService;

    public WalletController(WalletPassService walletPassService) {
        this.walletPassService = walletPassService;
    }

    @GetMapping("/pass")
    public ResponseEntity<byte[]> descargarPass(Authentication authentication) {
        String email = SecurityUtils.email(authentication);
        Usuario cliente = walletPassService.obtenerCliente(email);
        byte[] pkpass = walletPassService.generarPkpass(cliente);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.apple.pkpass"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("FidelyFood.pkpass").build());
        return ResponseEntity.ok().headers(headers).body(pkpass);
    }
}
