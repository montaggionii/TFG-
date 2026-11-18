package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Respuesta al pedir un código OTP por SMS")
public class OtpSendResponseDTO {

    @Schema(description = "Indica si se envió el código")
    private boolean enviado;

    @Schema(description = "Código en claro, SOLO en desarrollo (sin proveedor de SMS configurado). En producción es null.")
    private String devCodigo;

    public OtpSendResponseDTO() {
    }

    public OtpSendResponseDTO(boolean enviado, String devCodigo) {
        this.enviado = enviado;
        this.devCodigo = devCodigo;
    }

    public boolean isEnviado() {
        return enviado;
    }

    public String getDevCodigo() {
        return devCodigo;
    }
}
