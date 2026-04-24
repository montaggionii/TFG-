package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dto.MovimientoPuntosDTO;
import progresa.springboot_tfg.service.MovimientoPuntosService;

import java.util.List;

@RestController
@RequestMapping("/api/movimientos")
@CrossOrigin(origins = "*")
@Tag(name = "Movimientos de Puntos", description = "Consulta del historial de puntos de los usuarios")
public class MovimientoPuntosController {

    private final MovimientoPuntosService movimientoPuntosService;

    public MovimientoPuntosController(MovimientoPuntosService movimientoPuntosService) {
        this.movimientoPuntosService = movimientoPuntosService;
    }

    @Operation(
            summary = "Obtener historial de puntos",
            description = "Devuelve el historial completo de movimientos de puntos del usuario autenticado, incluyendo acumulaciones y canjes"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Historial obtenido correctamente"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado")
    })
    @GetMapping
    public ResponseEntity<List<MovimientoPuntosDTO>> obtenerHistorial(
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                movimientoPuntosService.obtenerHistorialUsuario(
                        authentication.getName()
                )
        );
    }
}