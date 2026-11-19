package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.dto.DashboardStatsDTO;
import progresa.springboot_tfg.dto.RestauranteAdvancedStatsDTO;
import progresa.springboot_tfg.dto.RestauranteDTO;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/restaurantes")
@CrossOrigin(origins = "*")
@Tag(name = "Restaurantes", description = "Gestión y consulta de restaurantes")
public class RestauranteController {

    private final RestauranteService restauranteService;
    private final progresa.springboot_tfg.service.InsightRestauranteService insightRestauranteService;
    private final progresa.springboot_tfg.dao.MovimientoPuntosDAO movimientoPuntosDAO;
    private final progresa.springboot_tfg.dao.UsuarioDAO usuarioDAO;
    private final progresa.springboot_tfg.dao.RestauranteDAO restauranteDAO;

    public RestauranteController(RestauranteService restauranteService,
                                 progresa.springboot_tfg.service.InsightRestauranteService insightRestauranteService,
                                 progresa.springboot_tfg.dao.MovimientoPuntosDAO movimientoPuntosDAO,
                                 progresa.springboot_tfg.dao.UsuarioDAO usuarioDAO,
                                 progresa.springboot_tfg.dao.RestauranteDAO restauranteDAO) {
        this.restauranteService = restauranteService;
        this.insightRestauranteService = insightRestauranteService;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
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

    @Operation(
            summary = "Obtener restaurantes cercanos",
            description = "Devuelve restaurantes con coordenadas dentro del radio indicado en kilómetros"
    )
    @GetMapping("/cercanos")
    public ResponseEntity<List<RestauranteDTO>> obtenerCercanos(
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(defaultValue = "10") double radio) {
        return ResponseEntity.ok(restauranteService.obtenerCercanosDTO(lat, lng, radio));
    }

    @Operation(
            summary = "Top fans del restaurante",
            description = "Los 5 clientes con más visitas registradas en el local y el puesto del usuario " +
                    "autenticado si está entre ellos. Solo primer nombre: otros datos nunca")
    @GetMapping("/{id}/top-fans")
    public ResponseEntity<Map<String, Object>> topFans(
            @PathVariable Long id,
            Authentication authentication) {
        SecurityUtils.requireAuthenticated(authentication);
        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        Map<Long, Integer> visitas = new java.util.LinkedHashMap<>();
        for (progresa.springboot_tfg.entity.MovimientoPuntos mov
                : movimientoPuntosDAO.findByRestauranteId(id)) {
            if (mov.getPuntos() > 0 && mov.getUsuario() != null
                    && !Boolean.TRUE.equals(mov.getUsuario().getDeleted())) {
                visitas.merge(mov.getUsuario().getId(), 1, Integer::sum);
            }
        }

        List<Map<String, Object>> ranking = new java.util.ArrayList<>();
        int puesto = 1;
        for (Map.Entry<Long, Integer> e : visitas.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .limit(5).toList()) {
            final int p = puesto++;
            usuarioDAO.findById(e.getKey()).ifPresent(u -> ranking.add(Map.of(
                    "puesto", p,
                    "nombre", primero(u.getNombre()),
                    "visitas", e.getValue()
            )));
        }

        String emailUsuario = SecurityUtils.email(authentication);
        Integer miPuesto = null;
        List<Long> orden = visitas.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .map(Map.Entry::getKey).toList();
        int idx = orden.indexOf(usuarioDAO.findByEmail(emailUsuario).map(Usuario::getId).orElse(-1L));
        if (idx >= 0) miPuesto = idx + 1;

        Map<String, Object> respuesta = new java.util.LinkedHashMap<>();
        respuesta.put("top", ranking);
        respuesta.put("miPuesto", miPuesto);
        respuesta.put("clientesTotales", visitas.size());
        return ResponseEntity.ok(respuesta);
    }

    private String primero(String nombre) {
        if (nombre == null || nombre.isBlank()) return "Anónimo";
        return nombre.split(" ")[0];
    }

    @Operation(
            summary = "Estadísticas del panel del restaurante",
            description = "Devuelve un resumen de puntos otorgados, canjeados y actividad reciente"
    )
    @GetMapping("/{id}/stats")
    public ResponseEntity<DashboardStatsDTO> obtenerStats(
            @PathVariable Long id,
            Authentication authentication) {
        return ResponseEntity.ok(restauranteService.obtenerStats(id, SecurityUtils.email(authentication)));
    }

    @Operation(
            summary = "Insights de fidelidad del restaurante",
            description = "Clientes inactivos (≥3 semanas sin volver), recurrentes, ganados/canjeados del mes, " +
                    "promo más canjeada y una sugerencia de acción"
    )
    @GetMapping("/{id}/insights")
    public ResponseEntity<Map<String, Object>> obtenerInsights(
            @PathVariable Long id,
            Authentication authentication) {
        restauranteService.obtenerStats(id, SecurityUtils.email(authentication)); // ownership + rol
        return ResponseEntity.ok(insightRestauranteService.insights(id));
    }

    @Operation(
            summary = "Estadísticas avanzadas del restaurante",
            description = "Devuelve facturación, ticket promedio e historial completo de movimientos"
    )
    @GetMapping("/{id}/stats-avanzadas")
    public ResponseEntity<RestauranteAdvancedStatsDTO> obtenerStatsAvanzadas(
            @PathVariable Long id,
            Authentication authentication) {
        return ResponseEntity.ok(restauranteService.obtenerStatsAvanzadas(id, SecurityUtils.email(authentication)));
    }

    @Operation(
            summary = "Estadisticas por periodo con comparacion",
            description = "Ventas, clientes y puntos reales de la semana/mes/anio actual, opcionalmente comparados con el periodo anterior"
    )
    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<progresa.springboot_tfg.dto.EstadisticasComparativasDTO> obtenerEstadisticasPeriodo(
            @PathVariable Long id,
            @RequestParam(defaultValue = "SEMANA") String periodo,
            @RequestParam(defaultValue = "true") boolean comparar,
            Authentication authentication) {
        return ResponseEntity.ok(
                restauranteService.obtenerEstadisticasPeriodo(id, SecurityUtils.email(authentication), periodo, comparar)
        );
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
            @RequestBody Restaurante restaurante,
            Authentication authentication) {
        return ResponseEntity.ok(restauranteService.actualizar(id, restaurante, SecurityUtils.email(authentication)));
    }

    @Operation(
            summary = "Subir imagen de restaurante",
            description = "Guarda una imagen de perfil del restaurante y actualiza su URL pública"
    )
    @PostMapping(value = "/{id}/imagen", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RestauranteDTO> subirImagen(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        return ResponseEntity.ok(restauranteService.subirImagen(id, file, SecurityUtils.email(authentication)));
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
    public ResponseEntity<Void> eliminar(
            @PathVariable Long id,
            Authentication authentication) {
        restauranteService.eliminarPropio(id, SecurityUtils.email(authentication));
        return ResponseEntity.noContent().build();
    }
}
