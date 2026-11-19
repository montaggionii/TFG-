package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.PromocionDAO;
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
    private final progresa.springboot_tfg.service.PuntosStreamService puntosStreamService;
    private final PromocionDAO promocionDAO;

    public PuntosController(
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO,
            PromocionDAO promocionDAO,
            progresa.springboot_tfg.service.PuntosStreamService puntosStreamService) {
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.promocionDAO = promocionDAO;
        this.puntosStreamService = puntosStreamService;
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

        // Presupuesto de comidas: importe de las compras del mes y nº de visitas
        double gastoMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1))
                        && mov.getMonto() != null && mov.getMonto() > 0)
                .mapToDouble(MovimientoPuntos::getMonto).sum();
        long visitasMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1)))
                .count();
        resumen.put("gastoMes", Math.round(gastoMes * 100) / 100.0);
        resumen.put("visitasMes", visitasMes);

        // Pasaporte de sabor: visita N locales distintos para desbloquear premio
        int PASAPORTE_OBJETIVO = 3;
        resumen.put("pasaporte", Map.of(
                "visitados", locales.size(),
                "objetivo", PASAPORTE_OBJETIVO,
                "completado", locales.size() >= PASAPORTE_OBJETIVO,
                "premioReclamado", premioPasaporteReclamado(usuario)
        ));
        return ResponseEntity.ok(resumen);
    }

    private boolean premioPasaporteReclamado(Usuario usuario) {
        return movimientoPuntosDAO.findByUsuario(usuario).stream()
                .anyMatch(mov -> "PASAPORTE".equals(mov.getMotivoInterno()));
    }

    @Operation(summary = "Reclamar el premio del Pasaporte de Sabor",
            description = "Una vez por usuario: al visitar 3 locales distintos se otorgan 25 puntos de regalo")
    @PostMapping("/{usuarioId}/pasaporte/reclamar")
    public ResponseEntity<Map<String, Object>> reclamarPasaporte(
            @PathVariable Long usuarioId,
            Authentication authentication) {
        Usuario usuario = getOwnedUsuario(usuarioId, authentication);
        if (premioPasaporteReclamado(usuario)) {
            throw new BadRequestException("El premio del pasaporte ya se ha reclamado");
        }
        long locales = movimientoPuntosDAO.findByUsuario(usuario).stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getRestaurante() != null)
                .map(mov -> mov.getRestaurante().getId())
                .distinct().count();
        if (locales < 3) {
            throw new BadRequestException("Aún no has visitado 3 locales distintos");
        }
        int premio = 25;
        usuario.setPuntos(usuario.getPuntos() + premio);
        usuarioDAO.save(usuario);

        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setPuntos(premio);
        mov.setTipo("GANADOS");
        mov.setMotivoInterno("PASAPORTE");
        mov.setDescripcion("Premio del Pasaporte de Sabor: 3 locales visitados");
        movimientoPuntosDAO.save(mov);

        return ResponseEntity.ok(Map.of("premio", premio, "puntos", usuario.getPuntos()));
    }

    @Operation(summary = "Sorpresa del día",
            description = "Una vez cada 20h: puntos de regalo aleatorios (5-25). Persistente porque " +
                    "queda registrada con motivo interno RULETA_DIA")
    @PostMapping("/sorpresa")
    public ResponseEntity<Map<String, Object>> sorpresaDelDia(Authentication authentication) {
        Usuario usuario = usuarioDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        LocalDateTime limite = LocalDateTime.now().minusHours(20);
        boolean yaJugada = movimientoPuntosDAO.findByUsuario(usuario).stream()
                .filter(mov -> "RULETA_DIA".equals(mov.getMotivoInterno()) && mov.getFecha() != null)
                .anyMatch(mov -> mov.getFecha().isAfter(limite));
        if (yaJugada) {
            throw new BadRequestException("La sorpresa de hoy ya la has cogido. Vuelve mañana");
        }

        int premio = new int[]{5, 5, 10, 10, 15, 25}[(int) (Math.random() * 6)];
        usuario.setPuntos(usuario.getPuntos() + premio);
        usuarioDAO.save(usuario);

        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setPuntos(premio);
        mov.setTipo("GANADOS");
        mov.setMotivoInterno("RULETA_DIA");
        mov.setDescripcion("Sorpresa del día");
        movimientoPuntosDAO.save(mov);

        return ResponseEntity.ok(Map.of("premio", premio, "puntos", usuario.getPuntos()));
    }

    @Operation(summary = "Recomendación contextual",
            description = "El restaurante cercano al que le faltan menos puntos al cliente para " +
                    "una recompensa canjeable (usa lat/lng y el saldo por local)")
    @GetMapping("/{usuarioId}/recomendacion")
    public ResponseEntity<Map<String, Object>> recomendacion(
            @PathVariable Long usuarioId,
            @RequestParam double lat,
            @RequestParam double lng,
            Authentication authentication) {
        Usuario usuario = getOwnedUsuario(usuarioId, authentication);

        record Candidato(Restaurante r, int saldoLocal, int coste, double distancia) {}
        List<Candidato> candidatos = new ArrayList<>();
        for (Restaurante r : restauranteDAO.findAll()) {
            if (r.getLatitud() == null || r.getLongitud() == null) continue;
            int saldoLocal = movimientoPuntosDAO.findByUsuario(usuario).stream()
                    .filter(mov -> mov.getRestaurante() != null && r.getId().equals(mov.getRestaurante().getId()))
                    .mapToInt(MovimientoPuntos::getPuntos).sum();
            int coste = promocionDAO.findByRestauranteIdAndTipoIgnoreCaseAndActivaTrue(r.getId(), "CANJEAR").stream()
                    .mapToInt(p -> p.getPuntosOtorgados()).min().orElse(Integer.MAX_VALUE);
            if (coste == Integer.MAX_VALUE || saldoLocal >= coste) continue;
            double dist = distanciaKm(lat, lng, r.getLatitud(), r.getLongitud());
            if (dist <= 5.0) candidatos.add(new Candidato(r, saldoLocal, coste, dist));
        }
        if (candidatos.isEmpty()) return ResponseEntity.noContent().build();

        Candidato mejor = candidatos.stream()
                .min(Comparator.comparingInt(c -> c.coste - c.saldoLocal))
                .orElseThrow();
        return ResponseEntity.ok(Map.of(
                "restauranteId", mejor.r.getId(),
                "restaurante", mejor.r.getNombre(),
                "distanciaKm", Math.round(mejor.distancia * 100) / 100.0,
                "promo", mejor.r == null ? "" : promocionDAO.findByRestauranteIdAndTipoIgnoreCaseAndActivaTrue(mejor.r.getId(), "CANJEAR").stream()
                        .filter(p -> p.getPuntosOtorgados() == mejor.coste).findFirst()
                        .map(p -> p.getTitulo()).orElse(""),
                "coste", mejor.coste,
                "saldoLocal", mejor.saldoLocal,
                "faltan", mejor.coste - mejor.saldoLocal
        ));
    }

    private double distanciaKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

    // Stream SSE de puntos en tiempo real
    @GetMapping(value = "/{usuarioId}/stream", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream(
            @PathVariable Long usuarioId, Authentication authentication) {
        getOwnedUsuario(usuarioId, authentication);
        return puntosStreamService.suscribir(usuarioId);
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
