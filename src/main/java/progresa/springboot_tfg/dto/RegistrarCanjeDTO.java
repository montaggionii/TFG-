package progresa.springboot_tfg.dto;

public class RegistrarCanjeDTO {
    private Long usuarioId;
    private Long promocionId;

    public RegistrarCanjeDTO() {}

    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public Long getPromocionId() { return promocionId; }
    public void setPromocionId(Long promocionId) { this.promocionId = promocionId; }
}
