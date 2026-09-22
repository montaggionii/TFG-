package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "Información básica de un usuario dentro del sistema de fidelización")
public class UsuarioDTO {

    @Schema(
            description = "ID único del usuario",
            example = "1"
    )
    private Long id;

    @Schema(
            description = "Nombre del usuario",
            example = "Omar España"
    )
    private String nombre;

    @Schema(
            description = "Correo electrónico del usuario",
            example = "usuario@email.com"
    )
    private String email;

    @Schema(
            description = "Cantidad total de puntos acumulados por el usuario",
            example = "150"
    )
    private int puntos;

    // 🔥 NUEVO CAMPO
    @Schema(
            description = "Código QR único del usuario para identificación en el sistema",
            example = "USER_1_a8f5f167f44f4964e6c998dee827110c"
    )
    private String qrCode;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String fotoPerfil;

    public UsuarioDTO() {
    }

    // ✔ Constructor antiguo (lo mantenemos por seguridad)
    public UsuarioDTO(Long id, String nombre, String email, int puntos) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.puntos = puntos;
    }

    // 🔥 NUEVO constructor (el que usa UsuarioService)
    public UsuarioDTO(Long id, String nombre, String email, int puntos, String qrCode) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.puntos = puntos;
        this.qrCode = qrCode;
    }

    public UsuarioDTO(Long id, String nombre, String email, int puntos, String qrCode, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
        this.puntos = puntos;
        this.qrCode = qrCode;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UsuarioDTO(Long id, String nombre, String email, int puntos, String qrCode, LocalDateTime createdAt, LocalDateTime updatedAt, String fotoPerfil) {
        this(id, nombre, email, puntos, qrCode, createdAt, updatedAt);
        this.fotoPerfil = fotoPerfil;
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

    // 🔥 NUEVO getter
    public String getQrCode() {
        return qrCode;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public String getFotoPerfil() {
        return fotoPerfil;
    }

    public void setFotoPerfil(String fotoPerfil) {
        this.fotoPerfil = fotoPerfil;
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

    // 🔥 NUEVO setter
    public void setQrCode(String qrCode) {
        this.qrCode = qrCode;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
