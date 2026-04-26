package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para aplicar una promoción a un usuario")
public class AplicarPromocionDTO {

    @Schema(
            description = "ID del usuario al que se le aplicará la promoción",
            example = "1",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private Long usuarioId;

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }
}