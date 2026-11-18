package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * id_token que el cliente obtiene del proveedor (Google Sign-In o
 * Sign in with Apple) y que el backend verifica para crear la sesión.
 */
@Schema(description = "Credencial social para iniciar sesión con Google o Apple")
public class SocialLoginRequestDTO {

    @Schema(
            description = "id_token (JWT) emitido por Google o Apple",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String idToken;

    @Schema(
            description = "Nombre visible del usuario (Apple solo lo envía en el primer alta)",
            requiredMode = Schema.RequiredMode.NOT_REQUIRED
    )
    private String nombre;

    public String getIdToken() {
        return idToken;
    }

    public void setIdToken(String idToken) {
        this.idToken = idToken;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }
}
