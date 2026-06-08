package progresa.springboot_tfg.dto;

import java.util.List;

public class DashboardStatsDTO {
    private double ventasHoy;
    private int clientesNuevos;
    private List<MovimientoPuntosDTO> actividadReciente;

    public DashboardStatsDTO(double ventasHoy, int clientesNuevos, List<MovimientoPuntosDTO> actividadReciente) {
        this.ventasHoy = ventasHoy;
        this.clientesNuevos = clientesNuevos;
        this.actividadReciente = actividadReciente;
    }

    // Getters y Setters
    public double getVentasHoy() { return ventasHoy; }
    public void setVentasHoy(double ventasHoy) { this.ventasHoy = ventasHoy; }

    public int getClientesNuevos() { return clientesNuevos; }
    public void setClientesNuevos(int clientesNuevos) { this.clientesNuevos = clientesNuevos; }

    public List<MovimientoPuntosDTO> getActividadReciente() { return actividadReciente; }
    public void setActividadReciente(List<MovimientoPuntosDTO> actividadReciente) { this.actividadReciente = actividadReciente; }
}
