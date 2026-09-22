package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.SecurityUtils;

import java.util.Map;

@RestController
@RequestMapping("/api/puntos")
public class PuntosController {

    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public PuntosController(
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO) {
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    @GetMapping("/{usuarioId}/total")
    public ResponseEntity<Map<String, Integer>> totalUsuario(
            @PathVariable Long usuarioId,
            Authentication authentication) {
        Usuario usuario = getOwnedUsuario(usuarioId, authentication);
        return ResponseEntity.ok(Map.of("puntos", usuario.getPuntos()));
    }

    @GetMapping("/{usuarioId}/{restauranteId}")
    public ResponseEntity<Map<String, Integer>> puntosPorRestaurante(
            @PathVariable Long usuarioId,
            @PathVariable Long restauranteId,
            Authentication authentication) {
        Usuario usuario = getOwnedUsuario(usuarioId, authentication);
        int total = movimientoPuntosDAO.findByUsuario(usuario).stream()
                .filter(mov -> mov.getRestaurante() != null && restauranteId.equals(mov.getRestaurante().getId()))
                .mapToInt(MovimientoPuntos::getPuntos)
                .sum();
        return ResponseEntity.ok(Map.of("puntos", total));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> sumarPuntos(
            @RequestBody Map<String, Object> data,
            Authentication authentication) {
        SecurityUtils.requireRole(authentication, "ROLE_RESTAURANT");

        Restaurante restaurante = restauranteDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        Long usuarioId = longValue(data.get("usuarioId"));
        Long restauranteId = longValue(data.get("restauranteId"));
        double monto = doubleValue(data.get("monto"));
        int puntos = intValue(data.get("puntos"));

        if (usuarioId == null) throw new BadRequestException("Usuario requerido");
        if (restauranteId != null && !restaurante.getId().equals(restauranteId)) {
            throw new AccessDeniedException("No puedes asignar puntos desde otro restaurante");
        }
        if (monto <= 0 || puntos <= 0) {
            throw new BadRequestException("Monto y puntos deben ser mayores que cero");
        }

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        usuario.setPuntos(usuario.getPuntos() + puntos);
        usuarioDAO.save(usuario);

        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setRestaurante(restaurante);
        mov.setPuntos(puntos);
        mov.setMonto(monto);
        mov.setTipo("GANADOS");
        mov.setDescripcion("Compra registrada en " + restaurante.getNombre());
        movimientoPuntosDAO.save(mov);

        return ResponseEntity.ok(Map.of(
                "usuarioId", usuario.getId(),
                "restauranteId", restaurante.getId(),
                "puntos", puntos,
                "total", usuario.getPuntos()
        ));
    }

    private Usuario getOwnedUsuario(Long usuarioId, Authentication authentication) {
        SecurityUtils.requireRole(authentication, "ROLE_USER");
        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        if (!usuario.getEmail().equalsIgnoreCase(SecurityUtils.email(authentication))) {
            throw new AccessDeniedException("No puedes consultar puntos de otro usuario");
        }
        return usuario;
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int intValue(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private double doubleValue(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
