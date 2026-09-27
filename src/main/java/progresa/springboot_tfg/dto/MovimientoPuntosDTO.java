package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "Representa un movimiento de puntos de un usuario, ya sea acumulación o canje")
public class MovimientoPuntosDTO {

    @Schema(
            description = "Cantidad de puntos del movimiento (positivos para acumulación, negativos para canje)",
            example = "10"
    )
    private int puntos;

    @Schema(
            description = "Tipo de movimiento",
            example = "ACUMULACION",
            allowableValues = {"ACUMULACION", "CANJE"}
    )
    private String tipo;

    @Schema(
            description = "Descripción del motivo del movimiento",
            example = "Compra realizada en Restaurante X"
    )
    private String descripcion;

    @Schema(
            description = "Fecha y hora en la que se realizó el movimiento",
            example = "2025-05-10T14:30:00"
    )
    private LocalDateTime fecha;

    @Schema(description = "Importe en euros del consumo asociado (0 si el movimiento no proviene de un consumo)", example = "15.00")
    private Double monto;

    @Schema(description = "Nombre del cliente que realizó el movimiento", example = "Juan Pérez")
    private String usuarioNombre;

    public MovimientoPuntosDTO(
            int puntos,
            String tipo,
            String descripcion,
            LocalDateTime fecha,
            Double monto,
            String usuarioNombre
    ) {
        this.puntos = puntos;
        this.tipo = tipo;
        this.descripcion = descripcion;
        this.fecha = fecha;
        this.monto = monto;
        this.usuarioNombre = usuarioNombre;
    }

    public int getPuntos() {
        return puntos;
    }

    public String getTipo() {
        return tipo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public Double getMonto() {
        return monto;
    }

    public String getUsuarioNombre() {
        return usuarioNombre;
    }
}