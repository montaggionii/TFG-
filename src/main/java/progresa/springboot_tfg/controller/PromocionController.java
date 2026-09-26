package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.PromocionService;
import progresa.springboot_tfg.dto.AplicarPromocionDTO;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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

    @GetMapping("/restaurante/{restauranteId}")
    public ResponseEntity<List<Promocion>> obtenerPorRestaurante(
            @PathVariable Long restauranteId,
            Authentication authentication) {
        if (SecurityUtils.hasRole(authentication, "ROLE_RESTAURANT")) {
            promocionService.validarRestauranteAutenticado(restauranteId, SecurityUtils.email(authentication));
        }
        return ResponseEntity.ok(promocionService.obtenerPorRestaurante(restauranteId));
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
    @PostMapping(consumes = org.springframework.http.MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Promocion> crear(
            @RequestBody Map<String, Object> data,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                promocionService.crear(toPromocion(data), SecurityUtils.email(authentication))
        );
    }

    @Operation(
            summary = "Crear promoción con imagen",
            description = "Igual que crear(), pero admite subir la imagen de la promoción en la misma petición"
    )
    @PostMapping(consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Promocion> crearConImagen(
            @RequestParam Map<String, String> data,
            @RequestParam(value = "imagen", required = false) org.springframework.web.multipart.MultipartFile imagen,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                promocionService.crearConImagen(toPromocion(data), imagen, SecurityUtils.email(authentication))
        );
    }

    @PutMapping("/{id}")
    public ResponseEntity<Promocion> actualizar(
            @PathVariable Long id,
            @RequestBody Map<String, Object> data,
            Authentication authentication) {
        return ResponseEntity.ok(
                promocionService.actualizar(id, toPromocion(data), SecurityUtils.email(authentication))
        );
    }

    @Operation(
            summary = "Actualizar promoción con imagen",
            description = "Igual que actualizar(), pero admite cambiar la imagen de la promoción en la misma petición"
    )
    @PostMapping(value = "/{id}", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Promocion> actualizarConImagen(
            @PathVariable Long id,
            @RequestParam Map<String, String> data,
            @RequestParam(value = "imagen", required = false) org.springframework.web.multipart.MultipartFile imagen,
            Authentication authentication) {
        return ResponseEntity.ok(
                promocionService.actualizarConImagen(id, toPromocion(data), imagen, SecurityUtils.email(authentication))
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @PathVariable Long id,
            Authentication authentication) {
        promocionService.eliminar(id, SecurityUtils.email(authentication));
        return ResponseEntity.noContent().build();
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
            @RequestBody AplicarPromocionDTO dto,
            Authentication authentication
    ) {
        promocionService.aplicarPromocion(id, dto.getUsuarioId(), SecurityUtils.email(authentication));
        return ResponseEntity.ok("Promoción aplicada y puntos sumados");
    }

    private Promocion toPromocion(Map<String, ?> data) {
        Promocion promocion = new Promocion();
        promocion.setTitulo(stringValue(data.get("titulo")));
        promocion.setDescripcion(stringValue(data.get("descripcion")));
        promocion.setPuntosOtorgados(intValue(data.get("puntosOtorgados"), intValue(data.get("puntosNecesarios"), 0)));
        String tipo = stringValue(data.get("tipo"));
        promocion.setTipo(tipo != null ? tipo : "GANAR");
        promocion.setImagenUrl(stringValue(data.get("imagenUrl")));
        promocion.setFechaInicio(dateValue(data.get("fechaInicio")));
        promocion.setFechaFin(dateValue(data.get("fechaFin")));
        Object activa = data.get("activa");
        promocion.setActiva(activa == null || Boolean.parseBoolean(String.valueOf(activa)));
        return promocion;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private int intValue(Object value, int fallback) {
        if (value == null) return fallback;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private LocalDate dateValue(Object value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(String.valueOf(value).substring(0, 10));
        } catch (Exception ex) {
            return null;
        }
    }
}
