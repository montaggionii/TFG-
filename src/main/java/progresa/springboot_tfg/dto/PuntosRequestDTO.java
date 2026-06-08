package progresa.springboot_tfg.dto;

public class PuntosRequestDTO {
    private Long usuarioId;
    private Long restauranteId;
    private Double monto;
    private Integer puntos;

    public Long getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Long usuarioId) {
        this.usuarioId = usuarioId;
    }

    public Long getRestauranteId() {
        return restauranteId;
    }

    public void setRestauranteId(Long restauranteId) {
        this.restauranteId = restauranteId;
    }

    public Double getMonto() {
        return monto;
    }

    public void setMonto(Double monto) {
        this.monto = monto;
    }

    public Integer getPuntos() {
        return puntos;
    }

    public void setPuntos(Integer puntos) {
        this.puntos = puntos;
    }

    @Override
    public String toString() {
        return "PuntosRequestDTO{" +
                "usuarioId=" + usuarioId +
                ", restauranteId=" + restauranteId +
                ", monto=" + monto +
                ", puntos=" + puntos +
                '}';
    }
}
