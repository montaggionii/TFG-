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

    public MovimientoPuntosDTO(
            int puntos,
            String tipo,
            String descripcion,
            LocalDateTime fecha
    ) {
        this.puntos = puntos;
        this.tipo = tipo;
        this.descripcion = descripcion;
        this.fecha = fecha;
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
}