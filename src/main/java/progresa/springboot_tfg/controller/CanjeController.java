package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.service.CanjeService;

import java.util.Map;

@RestController
@RequestMapping("/api/canjes")
@CrossOrigin(originPatterns = "*")
public class CanjeController {

    private final CanjeService canjeService;

    public CanjeController(CanjeService canjeService) {
        this.canjeService = canjeService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> canjearPromocion(@RequestBody CanjeRequest request) {
        return ResponseEntity.ok(canjeService.canjearPromocion(request.usuarioId(), request.promocionId()));
    }

    public record CanjeRequest(Long usuarioId, Long promocionId) {
    }
}
