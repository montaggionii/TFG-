package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "DTO para la información de una promoción")
public class PromocionDTO {

    private Long id;
    private String titulo;
    private String descripcion;
    private int puntosNecesarios;
    private String tipo;
    private String imagenUrl;
    private Long restauranteId;

    public PromocionDTO() {}

    public PromocionDTO(Long id, String titulo, String descripcion, int puntosNecesarios, String tipo, String imagenUrl, Long restauranteId) {
        this.id = id;
        this.titulo = titulo;
        this.descripcion = descripcion;
        this.puntosNecesarios = puntosNecesarios;
        this.tipo = tipo;
        this.imagenUrl = imagenUrl;
        this.restauranteId = restauranteId;
    }

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public int getPuntosNecesarios() { return puntosNecesarios; }
    public void setPuntosNecesarios(int puntosNecesarios) { this.puntosNecesarios = puntosNecesarios; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }
    public Long getRestauranteId() { return restauranteId; }
    public void setRestauranteId(Long restauranteId) { this.restauranteId = restauranteId; }
}
