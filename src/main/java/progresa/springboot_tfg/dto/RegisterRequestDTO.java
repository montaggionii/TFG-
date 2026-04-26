package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para registrar un nuevo usuario en el sistema")
public class RegisterRequestDTO {

    @Schema(
            description = "Nombre completo del usuario",
            example = "Omar España",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String nombre;

    @Schema(
            description = "Correo electrónico del usuario",
            example = "usuario@email.com",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String email;

    @Schema(
            description = "Contraseña del usuario",
            example = "123456",
            format = "password",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String password;

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}