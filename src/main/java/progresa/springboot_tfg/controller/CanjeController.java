package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dto.CanjePromocionDTO;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.PromocionService;

@RestController
@RequestMapping("/api/canjes")
@CrossOrigin(origins = "*")
@Tag(name = "Canjes", description = "Canje de promociones de tipo CANJEAR por parte de un cliente autenticado")
public class CanjeController {

    private final PromocionService promocionService;

    public CanjeController(PromocionService promocionService) {
        this.promocionService = promocionService;
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
        promocionService.canjearPromocion(dto.getPromocionId(), SecurityUtils.email(authentication));
        return ResponseEntity.ok("Promoción canjeada correctamente");
    }
}
