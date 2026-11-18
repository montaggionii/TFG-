package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Verificación del código OTP por SMS")
public class OtpVerifyRequestDTO {

        @Schema(
            description = "Número de teléfono del cliente",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String telefono;

    @Schema(
            description = "Código de 6 dígitos recibido por SMS",
            requiredMode = Schema.RequiredMode.REQUIRED
    )
    private String codigo;

    @Schema(
            description = "Nombre del cliente (solo si es su primera vez)",
            requiredMode = Schema.RequiredMode.NOT_REQUIRED
    )
    private String nombre;


    public OtpVerifyRequestDTO() {
    }

        public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }
}
