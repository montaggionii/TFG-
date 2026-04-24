package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Respuesta devuelta tras un login exitoso de usuario")
public class LoginResponseDTO {

    @Schema(
            description = "ID único del usuario",
            example = "1"
    )
    private Long id;

    @Schema(
            description = "Nombre del usuario",
            example = "Omar"
    )
    private String nombre;

    @Schema(
            description = "Correo electrónico del usuario",
            example = "usuario@email.com"
    )
    private String email;

    @Schema(
            description = "Cantidad de puntos acumulados por el usuario",
            example = "120"
    )
    private int puntos;

    @Schema(
            description = "Token JWT necesario para autenticar las siguientes peticiones",
            example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    )
    private String token;

    public LoginResponseDTO() {
    }

    public LoginResponseDTO(Long id, String nombre, String email, int puntos, String token) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.puntos = puntos;
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

    public int getPuntos() {
        return puntos;
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

    public void setPuntos(int puntos) {
        this.puntos = puntos;
    }

    public void setToken(String token) {
        this.token = token;
    }
}