package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.dto.RestauranteDTO;
import progresa.springboot_tfg.dto.UsuarioDTO;
import progresa.springboot_tfg.entity.AdminLog;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.service.AdminService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(originPatterns = "*")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard() {
        return ResponseEntity.ok(adminService.dashboard());
    }

    @GetMapping("/businesses")
    public ResponseEntity<List<RestauranteDTO>> businesses() {
        return ResponseEntity.ok(adminService.businesses());
    }

    @GetMapping("/businesses/{id}")
    public ResponseEntity<RestauranteDTO> business(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.business(id));
    }

    @PutMapping("/businesses/{id}")
    public ResponseEntity<RestauranteDTO> updateBusiness(
            @PathVariable Long id,
            @RequestBody Restaurante changes,
            Authentication authentication
    ) {
        return ResponseEntity.ok(adminService.updateBusiness(id, changes, adminEmail(authentication)));
    }

    @PatchMapping("/businesses/{id}/active")
    public ResponseEntity<RestauranteDTO> setBusinessActive(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(adminService.setBusinessActive(id, Boolean.TRUE.equals(request.get("active")), adminEmail(authentication)));
    }

    @GetMapping("/clients")
    public ResponseEntity<List<UsuarioDTO>> clients() {
        return ResponseEntity.ok(adminService.clients());
    }

    @GetMapping("/clients/{id}")
    public ResponseEntity<UsuarioDTO> client(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.client(id));
    }

    @PutMapping("/clients/{id}")
    public ResponseEntity<UsuarioDTO> updateClient(
            @PathVariable Long id,
            @RequestBody Usuario changes,
            Authentication authentication
    ) {
        return ResponseEntity.ok(adminService.updateClient(id, changes, adminEmail(authentication)));
    }

    @PatchMapping("/clients/{id}/active")
    public ResponseEntity<UsuarioDTO> setClientActive(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(adminService.setClientActive(id, Boolean.TRUE.equals(request.get("active")), adminEmail(authentication)));
    }

    @GetMapping("/reservations")
    public ResponseEntity<List<Map<String, Object>>> reservations() {
        return ResponseEntity.ok(adminService.reservations());
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(adminService.stats());
    }

    @GetMapping("/logs")
    public ResponseEntity<List<AdminLog>> logs() {
        return ResponseEntity.ok(adminService.logs());
    }

    private String adminEmail(Authentication authentication) {
        return authentication != null ? authentication.getName() : "admin";
    }
}
