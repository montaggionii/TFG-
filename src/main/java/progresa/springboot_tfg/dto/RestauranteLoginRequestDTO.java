package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para la autenticación de un restaurante")
public class RestauranteLoginRequestDTO {

    @Schema(
            description = "Correo electrónico del restaurante",
            example = "restaurante@email.com",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String email;

    @Schema(
            description = "Contraseña del restaurante",
            example = "123456",
            format = "password",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String password;

    public RestauranteLoginRequestDTO() {
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}