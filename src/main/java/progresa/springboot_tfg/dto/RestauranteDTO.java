package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

@Schema(description = "Información básica de un restaurante disponible en la plataforma")
public class RestauranteDTO {

    @Schema(
            description = "ID único del restaurante",
            example = "1"
    )
    private Long id;

    @Schema(
            description = "Nombre del restaurante",
            example = "La Consentida"
    )
    private String nombre;

    @Schema(
            description = "Dirección física del restaurante",
            example = "Av. del Puerto 195"
    )
    private String direccion;

    @Schema(
            description = "Ciudad donde se encuentra el restaurante",
            example = "Valencia"
    )
    private String ciudad;

    @Schema(
            description = "Número de teléfono de contacto del restaurante",
            example = "+34600123456"
    )
    private String telefono;

    @Schema(
            description = "Correo electrónico del restaurante",
            example = "contacto@laconsentida.com"
    )
    private String email;
    private String descripcion;
    private String imagen;
    private String imagenUrl;
    private String tipo;
    private Double latitud;
    private Double longitud;
    private String codigoPostal;
    private boolean active = true;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public RestauranteDTO() {
    }

    public RestauranteDTO(Long id, String nombre, String direccion,
                          String ciudad, String telefono, String email) {
        this.id = id;
        this.nombre = nombre;
        this.direccion = direccion;
        this.ciudad = ciudad;
        this.telefono = telefono;
        this.email = email;
    }

    public RestauranteDTO(Long id, String nombre, String direccion,
                          String ciudad, String telefono, String email,
                          String descripcion, String imagen, String imagenUrl,
                          String tipo, Double latitud, Double longitud,
                          String codigoPostal) {
        this(id, nombre, direccion, ciudad, telefono, email);
        this.descripcion = descripcion;
        this.imagen = imagen;
        this.imagenUrl = imagenUrl;
        this.tipo = tipo;
        this.latitud = latitud;
        this.longitud = longitud;
        this.codigoPostal = codigoPostal;
    }

    public RestauranteDTO(Long id, String nombre, String direccion,
                          String ciudad, String telefono, String email,
                          String descripcion, String imagen, String imagenUrl,
                          String tipo, Double latitud, Double longitud,
                          String codigoPostal, boolean active,
                          LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, nombre, direccion, ciudad, telefono, email, descripcion, imagen, imagenUrl,
                tipo, latitud, longitud, codigoPostal);
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getNombre() {
        return nombre;
    }

    public String getDireccion() {
        return direccion;
    }

    public String getCiudad() {
        return ciudad;
    }

    public String getTelefono() {
        return telefono;
    }

    public String getEmail() {
        return email;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public String getImagen() {
        return imagen;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public String getTipo() {
        return tipo;
    }

    public Double getLatitud() {
        return latitud;
    }

    public Double getLongitud() {
        return longitud;
    }

    public String getCodigoPostal() {
        return codigoPostal;
    }

    public boolean isActive() {
        return active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public void setDireccion(String direccion) {
        this.direccion = direccion;
    }

    public void setCiudad(String ciudad) {
        this.ciudad = ciudad;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public void setImagen(String imagen) {
        this.imagen = imagen;
    }

    public void setImagenUrl(String imagenUrl) {
        this.imagenUrl = imagenUrl;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public void setLatitud(Double latitud) {
        this.latitud = latitud;
    }

    public void setLongitud(Double longitud) {
        this.longitud = longitud;
    }

    public void setCodigoPostal(String codigoPostal) {
        this.codigoPostal = codigoPostal;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
