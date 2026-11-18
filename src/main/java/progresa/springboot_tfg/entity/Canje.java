package progresa.springboot_tfg.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "canjes")
public class Canje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne(optional = false)
    @JoinColumn(name = "promocion_id", nullable = false)
    private Promocion promocion;

    @Column(nullable = false)
    private int puntosGastados;

    private LocalDateTime fecha;

    /** PENDIENTE (espera validación en caja), VALIDADO, CANCELADO. */
    private String estado;

    /** Token secreto de un solo uso que codifica el QR temporal. */
    @Column(length = 64)
    private String token;

    /** Caducidad del token: pasado este tiempo el canje se cancela con reembolso. */
    private LocalDateTime tokenExpira;

    private LocalDateTime fechaValidacion;

    public boolean isPendiente() {
        return estado == null || estado.isBlank() || "PENDIENTE".equalsIgnoreCase(estado);
    }

    public Canje() {
        this.fecha = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public Promocion getPromocion() {
        return promocion;
    }

    public void setPromocion(Promocion promocion) {
        this.promocion = promocion;
    }

    public int getPuntosGastados() {
        return puntosGastados;
    }

    public void setPuntosGastados(int puntosGastados) {
        this.puntosGastados = puntosGastados;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public void setFecha(LocalDateTime fecha) {
        this.fecha = fecha;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public LocalDateTime getTokenExpira() {
        return tokenExpira;
    }

    public void setTokenExpira(LocalDateTime tokenExpira) {
        this.tokenExpira = tokenExpira;
    }

    public LocalDateTime getFechaValidacion() {
        return fechaValidacion;
    }

    public void setFechaValidacion(LocalDateTime fechaValidacion) {
        this.fechaValidacion = fechaValidacion;
    }
}
