package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para la autenticación de un usuario")
public class LoginRequestDTO {

    @Schema(
            description = "Correo electrónico del usuario",
            example = "usuario@email.com",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String email;

    @Schema(
            description = "Contraseña del usuario",
            example = "123456",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String password;

    public LoginRequestDTO() {
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