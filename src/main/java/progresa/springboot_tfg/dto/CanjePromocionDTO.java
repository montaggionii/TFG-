package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos para canjear una promoción de tipo CANJEAR")
public class CanjePromocionDTO {

    @Schema(
            description = "Ignorado por el backend: el usuario que canjea se identifica siempre por el token JWT, nunca por este campo. Se acepta solo por compatibilidad con el payload que ya envía el frontend.",
            example = "1"
    )
    private Long usuarioId;

    @Schema(
            description = "ID de la promoción (tipo CANJEAR) a canjear",
            example = "7",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private Long promocionId;

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public Long getPromocionId() {
        return promocionId;
    }

    public void setPromocionId(Long promocionId) {
        this.promocionId = promocionId;
    }
}
