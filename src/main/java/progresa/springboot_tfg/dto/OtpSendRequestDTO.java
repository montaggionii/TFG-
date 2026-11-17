package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Teléfono al que enviar el código de acceso")
public class OtpSendRequestDTO {

        @Schema(
            description = "Número de teléfono del cliente",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String telefono;


    public OtpSendRequestDTO() {
    }

        public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }
}
