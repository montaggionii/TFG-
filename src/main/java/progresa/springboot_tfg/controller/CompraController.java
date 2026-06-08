package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dto.RegistrarCompraDTO;
import progresa.springboot_tfg.service.CompraService;

@RestController
@RequestMapping("/api/compras")
@CrossOrigin(originPatterns = "*")
@Tag(name = "Compras", description = "Gestión de compras y acumulación de puntos")
public class CompraController {

    private final CompraService compraService;

    public CompraController(CompraService compraService) {
        this.compraService = compraService;
    }

    @Operation(
            summary = "Registrar compra",
            description = "Registra una compra realizada por un usuario y genera automáticamente puntos de fidelización asociados"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Compra registrada y puntos acumulados correctamente"),
            @ApiResponse(responseCode = "400", description = "Datos de compra inválidos"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado")
    })
    @PostMapping
    public ResponseEntity<?> registrarCompra(
            @RequestBody RegistrarCompraDTO dto
    ) {
        compraService.registrarCompra(
                dto.getUsuarioId(),
                dto.getImporte()
        );

        return ResponseEntity.ok("Compra registrada y puntos sumados");
    }
}
