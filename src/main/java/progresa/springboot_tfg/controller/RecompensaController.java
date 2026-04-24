package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.entity.Recompensa;
import progresa.springboot_tfg.service.RecompensaService;
import org.springframework.security.core.Authentication;

import java.util.List;

@RestController
@RequestMapping("/api/recompensas")
@CrossOrigin(origins = "*")
@Tag(name = "Recompensas", description = "Gestión de recompensas y canje por puntos")
public class RecompensaController {

    private final RecompensaService recompensaService;

    public RecompensaController(RecompensaService recompensaService) {
        this.recompensaService = recompensaService;
    }

    @Operation(
            summary = "Obtener todas las recompensas",
            description = "Devuelve la lista de recompensas disponibles que los usuarios pueden canjear con sus puntos"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Recompensas obtenidas correctamente")
    })
    @GetMapping
    public ResponseEntity<List<Recompensa>> obtenerTodas() {
        return ResponseEntity.ok(recompensaService.obtenerTodas());
    }

    @Operation(
            summary = "Obtener recompensa por ID",
            description = "Devuelve el detalle de una recompensa específica"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Recompensa encontrada"),
            @ApiResponse(responseCode = "404", description = "Recompensa no encontrada")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Recompensa> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(recompensaService.obtenerPorId(id));
    }

    @Operation(
            summary = "Crear recompensa",
            description = "Permite crear una nueva recompensa que los usuarios podrán canjear con puntos"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Recompensa creada correctamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos")
    })
    @PostMapping
    public ResponseEntity<Recompensa> crear(@RequestBody Recompensa recompensa) {
        return new ResponseEntity<>(
                recompensaService.crear(recompensa),
                HttpStatus.CREATED
        );
    }

    @Operation(
            summary = "Actualizar recompensa",
            description = "Actualiza los datos de una recompensa existente"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Recompensa actualizada correctamente"),
            @ApiResponse(responseCode = "404", description = "Recompensa no encontrada")
    })
    @PutMapping("/{id}")
    public ResponseEntity<Recompensa> actualizar(
            @PathVariable Long id,
            @RequestBody Recompensa recompensa) {
        return ResponseEntity.ok(
                recompensaService.actualizar(id, recompensa)
        );
    }

    @Operation(
            summary = "Eliminar recompensa",
            description = "Elimina una recompensa del sistema"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Recompensa eliminada correctamente"),
            @ApiResponse(responseCode = "404", description = "Recompensa no encontrada")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        recompensaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Canjear recompensa",
            description = "Permite a un usuario autenticado canjear una recompensa utilizando sus puntos disponibles"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Recompensa canjeada correctamente"),
            @ApiResponse(responseCode = "400", description = "Puntos insuficientes o canje no válido"),
            @ApiResponse(responseCode = "401", description = "Usuario no autenticado"),
            @ApiResponse(responseCode = "404", description = "Recompensa no encontrada")
    })
    @PostMapping("/{id}/canjear")
    public ResponseEntity<?> canjear(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String emailUsuario = authentication.getName();
        recompensaService.canjearRecompensa(id, emailUsuario);
        return ResponseEntity.ok("Recompensa canjeada correctamente");
    }

}