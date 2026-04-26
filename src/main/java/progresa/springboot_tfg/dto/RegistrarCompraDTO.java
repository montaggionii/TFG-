package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Datos necesarios para registrar una compra y generar puntos de fidelización")
public class RegistrarCompraDTO {

    @Schema(
            description = "ID del usuario que realiza la compra",
            example = "1",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private Long usuarioId;

    @Schema(
            description = "Importe total de la compra realizada",
            example = "25.50",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private double importe;

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public double getImporte() {
        return importe;
    }

    public void setImporte(double importe) {
        this.importe = importe;
    }
}