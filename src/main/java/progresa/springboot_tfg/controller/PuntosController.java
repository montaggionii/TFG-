package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.service.PuntosService;

import java.util.Map;

@RestController
@RequestMapping("/api/puntos")
@CrossOrigin(originPatterns = "*")
public class PuntosController {

    private final PuntosService puntosService;

    public PuntosController(PuntosService puntosService) {
        this.puntosService = puntosService;
    }

    @GetMapping("/{usuarioId}/{restauranteId}")
    public ResponseEntity<Map<String, Integer>> obtenerPuntosPorRestaurante(
            @PathVariable Long usuarioId,
            @PathVariable Long restauranteId
    ) {
        return ResponseEntity.ok(Map.of("puntos", puntosService.obtenerPuntosPorRestaurante(usuarioId, restauranteId)));
    }

    @GetMapping("/{usuarioId}/total")
    public ResponseEntity<Map<String, Integer>> obtenerTotalPuntos(@PathVariable Long usuarioId) {
        return ResponseEntity.ok(Map.of("puntos", puntosService.obtenerTotalPuntos(usuarioId)));
    }

    @PostMapping
    public ResponseEntity<Map<String, Integer>> sumarPuntos(@RequestBody SumarPuntosRequest request) {
        int saldoRestaurante = puntosService.sumarPuntos(
                request.usuarioId(),
                request.restauranteId(),
                request.monto(),
                request.puntos()
        );
        int saldoGlobal = puntosService.obtenerTotalPuntos(request.usuarioId());
        return ResponseEntity.ok(Map.of(
                "puntos", saldoRestaurante,
                "saldoRestaurante", saldoRestaurante,
                "saldoGlobal", saldoGlobal
        ));
    }

    public record SumarPuntosRequest(Long usuarioId, Long restauranteId, double monto, int puntos) {
    }
}
