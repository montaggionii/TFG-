package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.dto.RestauranteDTO;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/restaurantes")
@CrossOrigin(originPatterns = "*")
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
            summary = "Obtener restaurantes cercanos",
            description = "Devuelve restaurantes con coordenadas dentro del radio indicado en kilómetros"
    )
    @GetMapping("/cercanos")
    public ResponseEntity<List<RestauranteDTO>> obtenerCercanos(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "10") double radio
    ) {
        return ResponseEntity.ok(restauranteService.obtenerCercanosDTO(lat, lng, radio));
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
            summary = "Subir imagen de restaurante",
            description = "Guarda una imagen de perfil del restaurante y actualiza su URL pública"
    )
    @PostMapping(value = "/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RestauranteDTO> subirImagen(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws IOException {

        validarImagenRestaurante(file);

        Path uploadDir = Paths.get("uploads", "restaurantes").toAbsolutePath().normalize();
        Files.createDirectories(uploadDir);

        String extension = obtenerExtension(file.getOriginalFilename(), file.getContentType());
        String filename = "restaurant_" + id + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
        Path target = uploadDir.resolve(filename).normalize();

        if (!target.startsWith(uploadDir)) {
            throw new BadRequestException("Nombre de archivo no permitido");
        }

        file.transferTo(target);

        String publicPath = "/uploads/restaurantes/" + filename;
        return ResponseEntity.ok(restauranteService.actualizarImagen(id, publicPath));
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

    private void validarImagenRestaurante(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No se pudo subir la imagen");
        }

        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Archivo demasiado grande. Máximo 5MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Formato no permitido. Usa JPG, JPEG, PNG o WEBP");
        }
    }

    private String obtenerExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            String normalized = originalFilename.toLowerCase(Locale.ROOT);
            int dotIndex = normalized.lastIndexOf('.');
            if (dotIndex >= 0 && dotIndex < normalized.length() - 1) {
                String extension = normalized.substring(dotIndex);
                if (List.of(".jpg", ".jpeg", ".png", ".webp").contains(extension)) {
                    return extension;
                }
            }
        }

        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}
