package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.SecurityUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

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

    @Operation(summary = "Resumen de fidelidad del cliente",
            description = "Nivel (Bronce/Plata/Oro), racha de semanas consecutivas con compras, " +
                    "puntos del mes, locales visitados y última visita. Alimenta la gamificación " +
                    "y el panel de impacto del cliente.")
    @GetMapping("/{usuarioId}/resumen")
    public ResponseEntity<Map<String, Object>> resumenFidelidad(
            @PathVariable Long usuarioId,
            Authentication authentication) {
        Usuario usuario = getOwnedUsuario(usuarioId, authentication);
        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(usuario).stream()
                .filter(mov -> mov.getPuntos() > 0 || "CANJEADOS".equals(mov.getTipo()))
                .toList();

        int puntos = usuario.getPuntos();
        String nivel = puntos >= 500 ? "ORO" : puntos >= 100 ? "PLATA" : "BRONCE";
        int puntosParaSiguiente = puntos >= 500 ? 0 : puntos >= 100 ? 500 - puntos : 100 - puntos;

        // Racha: semanas naturales consecutivas (lunes-domingo) con al menos
        // una compra que diera puntos, contando desde la semana actual.
        WeekFields wf = WeekFields.ISO;
        Set<String> semanas = new HashSet<>();
        movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0)
                .filter(mov -> mov.getFecha() != null)
                .forEach(mov -> semanas.add(mov.getFecha().getYear() + "-" + mov.getFecha().get(wf.weekOfWeekBasedYear())));
        int racha = 0;
        LocalDate hoy = LocalDate.now();
        while (true) {
            String clave = hoy.getYear() + "-" + hoy.get(wf.weekOfWeekBasedYear());
            if (semanas.contains(clave)) {
                racha++;
                hoy = hoy.minusWeeks(1);
            } else {
                break;
            }
        }

        LocalDate inicioMes = LocalDate.now().withDayOfMonth(1);
        int ganadosMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1)))
                .mapToInt(MovimientoPuntos::getPuntos).sum();
        int gastadosMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() < 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1)))
                .mapToInt(MovimientoPuntos::getPuntos).sum();

        Set<Long> locales = movimientos.stream()
                .filter(mov -> mov.getRestaurante() != null)
                .map(mov -> mov.getRestaurante().getId())
                .collect(Collectors.toSet());

        LocalDateTime ultimaVisita = movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getFecha() != null)
                .map(MovimientoPuntos::getFecha)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("puntos", puntos);
        resumen.put("nivel", nivel);
        resumen.put("puntosParaSiguiente", puntosParaSiguiente);
        resumen.put("rachaSemanas", racha);
        resumen.put("ganadosMes", ganadosMes);
        resumen.put("gastadosMes", gastadosMes);
        resumen.put("localesVisitados", locales.size());
        resumen.put("ultimaVisita", ultimaVisita == null ? null : ultimaVisita.toString());
        return ResponseEntity.ok(resumen);
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
