package progresa.springboot_tfg.dto;

import io.swagger.v3.oas.annotations.media.Schema;

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
            description = "Codigo postal del restaurante",
            example = "46001"
    )
    private String codigoPostal;

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

    private String tipo;

    private String descripcion;

    private String foto;

    private Double latitud;

    private Double longitud;

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

    public RestauranteDTO(Long id, String nombre, String direccion, String ciudad, String telefono, String email,
                           String tipo, String descripcion, String foto, Double latitud, Double longitud,
                           String codigoPostal) {
        this(id, nombre, direccion, ciudad, telefono, email);
        this.tipo = tipo;
        this.descripcion = descripcion;
        this.foto = foto;
        this.latitud = latitud;
        this.longitud = longitud;
        this.codigoPostal = codigoPostal;
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

    public String getCodigoPostal() {
        return codigoPostal;
    }

    public String getTelefono() {
        return telefono;
    }

    public String getEmail() {
        return email;
    }

    public String getTipo() {
        return tipo;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public String getFoto() {
        return foto;
    }

    public Double getLatitud() {
        return latitud;
    }

    public Double getLongitud() {
        return longitud;
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

    public void setCodigoPostal(String codigoPostal) {
        this.codigoPostal = codigoPostal;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public void setFoto(String foto) {
        this.foto = foto;
    }

    public void setLatitud(Double latitud) {
        this.latitud = latitud;
    }

    public void setLongitud(Double longitud) {
        this.longitud = longitud;
    }
}
