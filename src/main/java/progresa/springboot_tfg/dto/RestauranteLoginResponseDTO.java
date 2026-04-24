package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Respuesta devuelta tras un login exitoso de un restaurante")
public class RestauranteLoginResponseDTO {

    @Schema(
            description = "ID único del restaurante",
            example = "1"
    )
    private Long id;

    @Schema(
            description = "Nombre del restaurante",
            example = "La Consentida"
    )
    private String nombre;

    @Schema(
            description = "Correo electrónico del restaurante",
            example = "restaurante@email.com"
    )
    private String email;

    @Schema(
            description = "Token JWT necesario para autenticar las siguientes peticiones del restaurante",
            example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    )
    private String token;

    public RestauranteLoginResponseDTO(Long id, String nombre, String email, String token) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.token = token;
    }

    public Long getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public String getEmail() {
        return email;
    }

    public String getToken() {
        return token;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setToken(String token) {
        this.token = token;
    }
}