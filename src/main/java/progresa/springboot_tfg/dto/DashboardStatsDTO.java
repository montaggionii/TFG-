package progresa.springboot_tfg.dto;

import java.util.List;

public class DashboardStatsDTO {
    private int clientesUnicos;
    private int puntosOtorgados;
    private int puntosCanjeados;
    private int promocionesActivas;
    private List<MovimientoPuntosDTO> actividadReciente;

    public DashboardStatsDTO() {
    }

    public DashboardStatsDTO(int clientesUnicos, int puntosOtorgados, int puntosCanjeados,
                              int promocionesActivas, List<MovimientoPuntosDTO> actividadReciente) {
        this.clientesUnicos = clientesUnicos;
        this.puntosOtorgados = puntosOtorgados;
        this.puntosCanjeados = puntosCanjeados;
        this.promocionesActivas = promocionesActivas;
        this.actividadReciente = actividadReciente;
    }

    public int getClientesUnicos() { return clientesUnicos; }
    public void setClientesUnicos(int clientesUnicos) { this.clientesUnicos = clientesUnicos; }

    public int getPuntosOtorgados() { return puntosOtorgados; }
    public void setPuntosOtorgados(int puntosOtorgados) { this.puntosOtorgados = puntosOtorgados; }

    public int getPuntosCanjeados() { return puntosCanjeados; }
    public void setPuntosCanjeados(int puntosCanjeados) { this.puntosCanjeados = puntosCanjeados; }

    public int getPromocionesActivas() { return promocionesActivas; }
    public void setPromocionesActivas(int promocionesActivas) { this.promocionesActivas = promocionesActivas; }

    public List<MovimientoPuntosDTO> getActividadReciente() { return actividadReciente; }
    public void setActividadReciente(List<MovimientoPuntosDTO> actividadReciente) { this.actividadReciente = actividadReciente; }
}
