package progresa.springboot_tfg.dto;

import java.time.LocalDate;
import java.util.List;

public class EstadisticasPeriodoDTO {

    public static class VentaDiaDTO {
        private LocalDate fecha;
        private double monto;
        private int transacciones;

        public VentaDiaDTO() {
        }

        public VentaDiaDTO(LocalDate fecha, double monto, int transacciones) {
            this.fecha = fecha;
            this.monto = monto;
            this.transacciones = transacciones;
        }

        public LocalDate getFecha() { return fecha; }
        public void setFecha(LocalDate fecha) { this.fecha = fecha; }
        public double getMonto() { return monto; }
        public void setMonto(double monto) { this.monto = monto; }
        public int getTransacciones() { return transacciones; }
        public void setTransacciones(int transacciones) { this.transacciones = transacciones; }
    }

    private LocalDate desde;
    private LocalDate hasta;
    private double ventasTotal;
    private double ticketPromedio;
    private int numTransacciones;
    private int clientesActivos;
    private int clientesNuevos;
    private int puntosOtorgados;
    private int puntosCanjeados;
    private List<VentaDiaDTO> ventasPorDia;
    private LocalDate mejorDiaFecha;
    private double mejorDiaMonto;

    public EstadisticasPeriodoDTO() {
    }

    public LocalDate getDesde() { return desde; }
    public void setDesde(LocalDate desde) { this.desde = desde; }
    public LocalDate getHasta() { return hasta; }
    public void setHasta(LocalDate hasta) { this.hasta = hasta; }
    public double getVentasTotal() { return ventasTotal; }
    public void setVentasTotal(double ventasTotal) { this.ventasTotal = ventasTotal; }
    public double getTicketPromedio() { return ticketPromedio; }
    public void setTicketPromedio(double ticketPromedio) { this.ticketPromedio = ticketPromedio; }
    public int getNumTransacciones() { return numTransacciones; }
    public void setNumTransacciones(int numTransacciones) { this.numTransacciones = numTransacciones; }
    public int getClientesActivos() { return clientesActivos; }
    public void setClientesActivos(int clientesActivos) { this.clientesActivos = clientesActivos; }
    public int getClientesNuevos() { return clientesNuevos; }
    public void setClientesNuevos(int clientesNuevos) { this.clientesNuevos = clientesNuevos; }
    public int getPuntosOtorgados() { return puntosOtorgados; }
    public void setPuntosOtorgados(int puntosOtorgados) { this.puntosOtorgados = puntosOtorgados; }
    public int getPuntosCanjeados() { return puntosCanjeados; }
    public void setPuntosCanjeados(int puntosCanjeados) { this.puntosCanjeados = puntosCanjeados; }
    public List<VentaDiaDTO> getVentasPorDia() { return ventasPorDia; }
    public void setVentasPorDia(List<VentaDiaDTO> ventasPorDia) { this.ventasPorDia = ventasPorDia; }
    public LocalDate getMejorDiaFecha() { return mejorDiaFecha; }
    public void setMejorDiaFecha(LocalDate mejorDiaFecha) { this.mejorDiaFecha = mejorDiaFecha; }
    public double getMejorDiaMonto() { return mejorDiaMonto; }
    public void setMejorDiaMonto(double mejorDiaMonto) { this.mejorDiaMonto = mejorDiaMonto; }
}
