package progresa.springboot_tfg.service;

import de.brendamour.jpasskit.PKPass;
import de.brendamour.jpasskit.enums.PKBarcodeFormat;
import org.junit.jupiter.api.Test;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.exception.WalletNotConfiguredException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WalletPassServiceTest {

    private final UsuarioDAO usuarioDAO = mock(UsuarioDAO.class);
    private final WalletPassService service = new WalletPassService(usuarioDAO);

    private Usuario cliente() {
        Usuario u = new Usuario();
        u.setId(7L);
        u.setNombre("Usuario Prueba");
        u.setEmail("prueba@test.com");
        u.setPuntos(42);
        u.setRole(Role.ROLE_USER);
        u.setQrCode("USER_7_abc123");
        return u;
    }

    @Test
    void construirPkPass_generaTarjetaConSaldoQrYMiembro() {
        PKPass pass = service.construirPkPass(cliente());

        assertThat(pass.getOrganizationName()).isEqualTo("FidelyFood");
        assertThat(pass.getSerialNumber()).isEqualTo("USER_7_abc123");
        assertThat(pass.getFormatVersion()).isEqualTo(1);
        assertThat(pass.getStoreCard()).isNotNull();
        assertThat(pass.getBarcodes()).hasSize(1);
        assertThat(pass.getBarcodes().get(0).getFormat()).isEqualTo(PKBarcodeFormat.PKBarcodeFormatQR);
        assertThat(pass.getBarcodes().get(0).getMessage()).isEqualTo("USER_7_abc123");

        // El saldo del usuario viaja en el campo primario de la tarjeta
        assertThat(pass.getStoreCard().getPrimaryFields()).anySatisfy(field -> {
            assertThat(field.getKey()).isEqualTo("saldo");
            assertThat(field.getValue()).isEqualTo(42);
        });
    }

    @Test
    void generarPkpass_sinCertificadoConfigurado_lanzaWalletNotConfigured() {
        assertThatThrownBy(() -> service.generarPkpass(cliente()))
                .isInstanceOf(WalletNotConfiguredException.class)
                .hasMessageContaining("APP_WALLET");
    }

    @Test
    void obtenerCliente_emailInexistente_lanzaNotFound() {
        when(usuarioDAO.findByEmail("nadie@test.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.obtenerCliente("nadie@test.com"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void obtenerCliente_rolRestaurante_lanzaBadRequest() {
        Usuario restaurante = cliente();
        restaurante.setRole(Role.ROLE_RESTAURANT);
        when(usuarioDAO.findByEmail("rest@test.com")).thenReturn(Optional.of(restaurante));
        assertThatThrownBy(() -> service.obtenerCliente("rest@test.com"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Solo los clientes");
    }
}
