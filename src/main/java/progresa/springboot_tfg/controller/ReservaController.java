package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminReservation;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.ReservaService;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservas")
@CrossOrigin(origins = "*")
@Tag(name = "Reservas", description = "Reservas de mesa entre clientes y restaurantes")
public class ReservaController {

    private final ReservaService reservaService;
    private final AdminReservationDAO reservaDAO;
    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;

    public ReservaController(ReservaService reservaService, AdminReservationDAO reservaDAO, UsuarioDAO usuarioDAO, RestauranteDAO restauranteDAO) {
        this.reservaService = reservaService;
        this.reservaDAO = reservaDAO;
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
    }

    @Operation(summary = "Crear una reserva", description = "El cliente autenticado reserva una mesa en un restaurante")
    @PostMapping
    public ResponseEntity<Map<String, Object>> crear(@RequestBody Map<String, Object> body, Authentication authentication) {
        Long restauranteId = body.get("restauranteId") == null ? null : Long.valueOf(String.valueOf(body.get("restauranteId")));
        int personas = body.get("personas") == null ? 0 : Integer.parseInt(String.valueOf(body.get("personas")));
        LocalDateTime fecha;
        try {
            fecha = LocalDateTime.parse(String.valueOf(body.get("fecha")));
        } catch (DateTimeParseException | NullPointerException e) {
            throw new BadRequestException("Fecha de reserva no válida (formato yyyy-MM-dd'T'HH:mm)");
        }
        AdminReservation reserva = reservaService.crear(restauranteId, SecurityUtils.email(authentication),
                fecha, personas, body.get("notas") == null ? null : String.valueOf(body.get("notas")));
        return ResponseEntity.ok(toDto(reserva));
    }

    @Operation(summary = "Mis reservas", description = "Lista las reservas del cliente autenticado")
    @GetMapping("/mias")
    public ResponseEntity<List<Map<String, Object>>> mias(Authentication authentication) {
        Usuario usuario = usuarioDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        return ResponseEntity.ok(reservaDAO.findByUsuarioIdAndDeletedFalseOrderByDateDesc(usuario.getId())
                .stream().map(ReservaController::toDto).toList());
    }

    @Operation(summary = "Cancelar una reserva", description = "El cliente cancela su reserva")
    @PostMapping("/{id}/cancelar")
    public ResponseEntity<Map<String, Object>> cancelar(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(toDto(reservaService.cancelar(id, SecurityUtils.email(authentication))));
    }

    @Operation(summary = "Reservas del restaurante", description = "Lista las reservas recibidas por el restaurante autenticado")
    @GetMapping("/restaurante")
    public ResponseEntity<List<Map<String, Object>>> delRestaurante(Authentication authentication) {
        Restaurante restaurante = restauranteDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));
        return ResponseEntity.ok(reservaDAO.findByRestauranteIdAndDeletedFalseOrderByDateDesc(restaurante.getId())
                .stream().map(ReservaController::toDto).toList());
    }

    @Operation(summary = "Cambiar el estado de una reserva", description = "El restaurante confirma (CONFIRMED) o rechaza/cancela (CANCELLED)")
    @PostMapping("/{id}/estado")
    public ResponseEntity<Map<String, Object>> estado(@PathVariable Long id,
                                                      @RequestBody Map<String, String> body,
                                                      Authentication authentication) {
        return ResponseEntity.ok(toDto(reservaService.cambiarEstado(id, SecurityUtils.email(authentication), body.get("estado"))));
    }

    static Map<String, Object> toDto(AdminReservation r) {
        Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", r.getId());
        dto.put("fecha", r.getDate() == null ? null : r.getDate().toString());
        dto.put("personas", r.getPeople());
        dto.put("estado", r.getStatus());
        dto.put("notas", r.getNotes());
        dto.put("cliente", r.getUsuario() != null ? r.getUsuario().getNombre() : r.getClientName());
        dto.put("clienteEmail", r.getUsuario() != null ? r.getUsuario().getEmail() : r.getClientEmail());
        dto.put("clienteTelefono", r.getUsuario() != null ? r.getUsuario().getTelefono() : r.getClientPhone());
        dto.put("restauranteNombre", r.getRestaurante() != null ? r.getRestaurante().getNombre() : r.getBusinessName());
        dto.put("restauranteId", r.getRestaurante() != null ? r.getRestaurante().getId() : null);
        return dto;
    }
}
