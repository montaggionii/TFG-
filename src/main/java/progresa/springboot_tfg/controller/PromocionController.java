package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.service.PromocionService;
import progresa.springboot_tfg.dto.AplicarPromocionDTO;

import java.util.List;

@RestController
@RequestMapping("/api/promociones")
@CrossOrigin(origins = "*")
@Tag(name = "Promociones", description = "Gestión de promociones y aplicación de beneficios para usuarios")
public class PromocionController {

    private final PromocionService promocionService;

    public PromocionController(PromocionService promocionService) {
        this.promocionService = promocionService;
    }

    @Operation(
            summary = "Obtener todas las promociones",
            description = "Devuelve la lista de promociones disponibles en el sistema"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Promociones obtenidas correctamente")
    })
    @GetMapping
    public ResponseEntity<List<Promocion>> obtenerTodas() {
        return ResponseEntity.ok(promocionService.obtenerTodas());
    }


    @Operation(
            summary = "Crear promoción",
            description = "Permite a un restaurante autenticado crear una nueva promoción asociada a su negocio"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Promoción creada correctamente"),
            @ApiResponse(responseCode = "401", description = "Restaurante no autenticado"),
            @ApiResponse(responseCode = "400", description = "Datos de promoción inválidos")
    })
    @PostMapping
    public ResponseEntity<Promocion> crear(
            @RequestBody Promocion promocion,
            Authentication authentication
    ) {
        // email del restaurante obtenido del JWT
        String emailRestaurante = authentication.getName();

        return ResponseEntity.ok(
                promocionService.crear(promocion, emailRestaurante)
        );
    }


    @Operation(
            summary = "Aplicar promoción a usuario",
            description = "Aplica una promoción a un usuario específico, generando puntos o beneficios asociados"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Promoción aplicada correctamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o promoción no aplicable"),
            @ApiResponse(responseCode = "404", description = "Promoción o usuario no encontrado")
    })
    @PostMapping("/{id}/aplicar")
    public ResponseEntity<?> aplicarPromocion(
            @PathVariable Long id,
            @RequestBody AplicarPromocionDTO dto
    ) {
        promocionService.aplicarPromocion(id, dto.getUsuarioId());
        return ResponseEntity.ok("Promoción aplicada y puntos sumados");
    }
}