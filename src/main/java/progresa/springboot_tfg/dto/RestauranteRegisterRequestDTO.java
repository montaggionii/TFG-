package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para registrar un nuevo restaurante en el sistema")
public class RestauranteRegisterRequestDTO {

    @Schema(
            description = "Nombre del restaurante",
            example = "La Consentida",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String nombre;

    @Schema(
            description = "Correo electrónico del restaurante",
            example = "contacto@laconsentida.com",
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

    @Schema(
            description = "Dirección física del restaurante",
            example = "Av. del Puerto 195",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String direccion;

    @Schema(
            description = "Ciudad donde se ubica el restaurante",
            example = "Valencia",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String ciudad;

    @Schema(
            description = "Teléfono de contacto del restaurante",
            example = "+34600123456",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String telefono;

    // getters y setters
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

    public String getDireccion() {
        return direccion;
    }

    public void setDireccion(String direccion) {
        this.direccion = direccion;
    }

    public String getCiudad() {
        return ciudad;
    }

    public void setCiudad(String ciudad) {
        this.ciudad = ciudad;
    }

    public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }
}