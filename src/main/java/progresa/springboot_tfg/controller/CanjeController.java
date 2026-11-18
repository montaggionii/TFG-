package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

import progresa.springboot_tfg.dto.CanjePromocionDTO;
import progresa.springboot_tfg.entity.Canje;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.CanjeService;
import progresa.springboot_tfg.service.PromocionService;

@RestController
@RequestMapping("/api/canjes")
@CrossOrigin(origins = "*")
@Tag(name = "Canjes", description = "Canje de promociones de tipo CANJEAR por parte de un cliente autenticado")
public class CanjeController {

    private final PromocionService promocionService;
    private final CanjeService canjeService;

    public CanjeController(PromocionService promocionService, CanjeService canjeService) {
        this.promocionService = promocionService;
        this.canjeService = canjeService;
    }

    @Operation(
            summary = "Canjear una promoción de tipo CANJEAR",
            description = "El cliente autenticado gasta sus puntos para canjear una promoción de un restaurante. " +
                    "El usuario se identifica siempre por el token JWT, nunca por el usuarioId del body."
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Promoción canjeada correctamente"),
            @ApiResponse(responseCode = "400", description = "Puntos insuficientes o la promoción no es de tipo CANJEAR"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado"),
            @ApiResponse(responseCode = "404", description = "Promoción o usuario no encontrado")
    })
    @PostMapping
    public ResponseEntity<?> canjear(
            @RequestBody CanjePromocionDTO dto,
            Authentication authentication
    ) {
        Canje canje = promocionService.canjearPromocion(dto.getPromocionId(), SecurityUtils.email(authentication));
        long expiraEn = canje.getTokenExpira() == null ? 600
                : Duration.between(LocalDateTime.now(), canje.getTokenExpira()).getSeconds();
        return ResponseEntity.ok(Map.of(
                "id", canje.getId(),
                "titulo", canje.getPromocion().getTitulo(),
                "puntosGastados", canje.getPuntosGastados(),
                "codigo", canjeService.codigoDe(canje),
                "expiraEn", expiraEn,
                "estado", canje.isPendiente() ? "PENDIENTE" : canje.getEstado()
        ));
    }

    @Operation(
            summary = "Estado de un canje",
            description = "Lo consulta el cliente mientras espera la validación en caja (o el restaurante)."
    )
    @GetMapping("/{id}")
    public ResponseEntity<?> estado(@PathVariable Long id, Authentication authentication) {
        Canje canje = canjeService.estado(id, SecurityUtils.email(authentication));
        long expiraEn = canje.getTokenExpira() == null ? 0
                : Math.max(0, Duration.between(LocalDateTime.now(), canje.getTokenExpira()).getSeconds());
        return ResponseEntity.ok(Map.of(
                "id", canje.getId(),
                "estado", canje.isPendiente() ? "PENDIENTE" : canje.getEstado(),
                "titulo", canje.getPromocion().getTitulo(),
                "puntosGastados", canje.getPuntosGastados(),
                "expiraEn", expiraEn
        ));
    }

    @Operation(
            summary = "Validar un canje escaneando el QR del cliente",
            description = "El restaurante escanea el QR temporal (CANJE:id:token) y marca el canje como usado. " +
                    "El token caduca a los 10 minutos y es de un solo uso."
    )
    @PostMapping("/{id}/validar")
    public ResponseEntity<?> validar(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        Canje canje = canjeService.validar(id, body.get("codigo"), SecurityUtils.email(authentication));
        return ResponseEntity.ok(Map.of(
                "id", canje.getId(),
                "estado", canje.getEstado(),
                "titulo", canje.getPromocion().getTitulo(),
                "cliente", canje.getUsuario().getNombre(),
                "puntosGastados", canje.getPuntosGastados()
        ));
    }

    @Operation(
            summary = "Cancelar un canje pendiente",
            description = "El cliente cancela un canje que nadie ha validado (o cuyo código ya caducó) " +
                    "y recupera los puntos gastados."
    )
    @PostMapping("/{id}/cancelar")
    public ResponseEntity<?> cancelar(@PathVariable Long id, Authentication authentication) {
        Canje canje = canjeService.cancelar(id, SecurityUtils.email(authentication));
        return ResponseEntity.ok(Map.of(
                "id", canje.getId(),
                "estado", canje.getEstado(),
                "puntosDevueltos", canje.getPuntosGastados()
        ));
    }
}
