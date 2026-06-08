package progresa.springboot_tfg.dto;

import java.util.List;
import java.util.Map;

public class RestauranteAdvancedStatsDTO {
    private double facturacionTotal;
    private int puntosEntregados;
    private int puntosCanjeados;
    private int clientesAtendidos;
    private int totalOperaciones;
    private double ticketPromedio;
    private List<MovimientoPuntosDTO> historialCompleto;
    private Map<String, Integer> promocionesMasUsadas;
    private Map<String, Double> ingresosPorDia;

    public RestauranteAdvancedStatsDTO() {}

    public RestauranteAdvancedStatsDTO(double facturacionTotal, int puntosEntregados, int puntosCanjeados, 
                                     int clientesAtendidos, int totalOperaciones, double ticketPromedio, 
                                     List<MovimientoPuntosDTO> historialCompleto) {
        this.facturacionTotal = facturacionTotal;
        this.puntosEntregados = puntosEntregados;
        this.puntosCanjeados = puntosCanjeados;
        this.clientesAtendidos = clientesAtendidos;
        this.totalOperaciones = totalOperaciones;
        this.ticketPromedio = ticketPromedio;
        this.historialCompleto = historialCompleto;
    }

    // Getters and Setters
    public double getFacturacionTotal() { return facturacionTotal; }
    public void setFacturacionTotal(double facturacionTotal) { this.facturacionTotal = facturacionTotal; }
    public int getPuntosEntregados() { return puntosEntregados; }
    public void setPuntosEntregados(int puntosEntregados) { this.puntosEntregados = puntosEntregados; }
    public int getPuntosCanjeados() { return puntosCanjeados; }
    public void setPuntosCanjeados(int puntosCanjeados) { this.puntosCanjeados = puntosCanjeados; }
    public int getClientesAtendidos() { return clientesAtendidos; }
    public void setClientesAtendidos(int clientesAtendidos) { this.clientesAtendidos = clientesAtendidos; }
    public int getTotalOperaciones() { return totalOperaciones; }
    public void setTotalOperaciones(int totalOperaciones) { this.totalOperaciones = totalOperaciones; }
    public double getTicketPromedio() { return ticketPromedio; }
    public void setTicketPromedio(double ticketPromedio) { this.ticketPromedio = ticketPromedio; }
    public List<MovimientoPuntosDTO> getHistorialCompleto() { return historialCompleto; }
    public void setHistorialCompleto(List<MovimientoPuntosDTO> historialCompleto) { this.historialCompleto = historialCompleto; }
    public Map<String, Integer> getPromocionesMasUsadas() { return promocionesMasUsadas; }
    public void setPromocionesMasUsadas(Map<String, Integer> promocionesMasUsadas) { this.promocionesMasUsadas = promocionesMasUsadas; }
    public Map<String, Double> getIngresosPorDia() { return ingresosPorDia; }
    public void setIngresosPorDia(Map<String, Double> ingresosPorDia) { this.ingresosPorDia = ingresosPorDia; }
}
