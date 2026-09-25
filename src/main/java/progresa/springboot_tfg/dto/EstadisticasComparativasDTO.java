package progresa.springboot_tfg.dto;

public class EstadisticasComparativasDTO {

    private EstadisticasPeriodoDTO actual;
    private EstadisticasPeriodoDTO anterior;
    private Double variacionVentasPct;
    private Double variacionClientesPct;
    private Double variacionTransaccionesPct;

    public EstadisticasComparativasDTO() {
    }

    public EstadisticasComparativasDTO(EstadisticasPeriodoDTO actual, EstadisticasPeriodoDTO anterior,
                                        Double variacionVentasPct, Double variacionClientesPct,
                                        Double variacionTransaccionesPct) {
        this.actual = actual;
        this.anterior = anterior;
        this.variacionVentasPct = variacionVentasPct;
        this.variacionClientesPct = variacionClientesPct;
        this.variacionTransaccionesPct = variacionTransaccionesPct;
    }

    public EstadisticasPeriodoDTO getActual() { return actual; }
    public void setActual(EstadisticasPeriodoDTO actual) { this.actual = actual; }
    public EstadisticasPeriodoDTO getAnterior() { return anterior; }
    public void setAnterior(EstadisticasPeriodoDTO anterior) { this.anterior = anterior; }
    public Double getVariacionVentasPct() { return variacionVentasPct; }
    public void setVariacionVentasPct(Double variacionVentasPct) { this.variacionVentasPct = variacionVentasPct; }
    public Double getVariacionClientesPct() { return variacionClientesPct; }
    public void setVariacionClientesPct(Double variacionClientesPct) { this.variacionClientesPct = variacionClientesPct; }
    public Double getVariacionTransaccionesPct() { return variacionTransaccionesPct; }
    public void setVariacionTransaccionesPct(Double variacionTransaccionesPct) { this.variacionTransaccionesPct = variacionTransaccionesPct; }
}
