package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.dto.RestauranteDTO;

import java.util.List;

@RestController
@RequestMapping("/api/restaurantes")
@CrossOrigin(origins = "*")
@Tag(name = "Restaurantes", description = "Gestión y consulta de restaurantes")
public class RestauranteController {

    private final RestauranteService restauranteService;

    public RestauranteController(RestauranteService restauranteService) {
        this.restauranteService = restauranteService;
    }

    @Operation(
            summary = "Obtener todos los restaurantes",
            description = "Devuelve la lista de restaurantes disponibles en el sistema, incluyendo su información básica y ubicación"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Lista de restaurantes obtenida correctamente")
    })
    @GetMapping
    public ResponseEntity<List<RestauranteDTO>> obtenerTodos() {
        return ResponseEntity.ok(restauranteService.obtenerTodosDTO());
    }

    @Operation(
            summary = "Obtener restaurante por ID",
            description = "Devuelve el detalle completo de un restaurante específico"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Restaurante encontrado"),
            @ApiResponse(responseCode = "404", description = "Restaurante no encontrado")
    })
    @GetMapping("/{id}")
    public ResponseEntity<RestauranteDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(restauranteService.obtenerPorIdDTO(id));
    }

    /*
    @Operation(
        summary = "Crear restaurante",
        description = "Crea un nuevo restaurante en el sistema"
    )
    @PostMapping
    public ResponseEntity<Restaurante> crear(@RequestBody Restaurante restaurante) {
        return new ResponseEntity<>(restauranteService.crear(restaurante), HttpStatus.CREATED);
    }
    */

    @Operation(
            summary = "Actualizar restaurante",
            description = "Actualiza la información de un restaurante existente"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Restaurante actualizado correctamente"),
            @ApiResponse(responseCode = "404", description = "Restaurante no encontrado")
    })
    @PutMapping("/{id}")
    public ResponseEntity<Restaurante> actualizar(
            @PathVariable Long id,
            @RequestBody Restaurante restaurante) {
        return ResponseEntity.ok(restauranteService.actualizar(id, restaurante));
    }

    @Operation(
            summary = "Eliminar restaurante",
            description = "Elimina un restaurante del sistema"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Restaurante eliminado correctamente"),
            @ApiResponse(responseCode = "404", description = "Restaurante no encontrado")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        restauranteService.eliminar(id);
        return ResponseEntity.noContent().build();
    }
}