package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;

import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Insights de fidelidad para el restaurante (la pieza analítica que el
 * Agent Layer puede consumir para proponer promociones):
 *  - clientes inactivos: les compraron hace ≥ 3 semanas y no vuelven;
 *  - clientes recurrentes: ≥ 2 compras registradas;
 *  - ticket medio del mes, ganados/canjeados del mes y promo más canjeada.
 */
@Service
public class InsightRestauranteService {

    private static final int SEMANAS_INACTIVO = 3;

    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final UsuarioDAO usuarioDAO;

    public InsightRestauranteService(RestauranteDAO restauranteDAO,
                                     MovimientoPuntosDAO movimientoPuntosDAO,
                                     UsuarioDAO usuarioDAO) {
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.usuarioDAO = usuarioDAO;
    }

    public Map<String, Object> insights(Long restauranteId) {
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findByRestauranteId(restauranteId).stream()
                .filter(mov -> !Boolean.TRUE.equals(mov.getUsuario().getDeleted()))
                .toList();

        // Última visita (compra con puntos) de cada cliente en este local
        Map<Long, LocalDateTime> ultimaVisita = new LinkedHashMap<>();
        Map<Long, Integer> visitas = new LinkedHashMap<>();
        for (MovimientoPuntos mov : movimientos) {
            if (mov.getUsuario() == null || mov.getRestaurante() == null || mov.getFecha() == null) continue;
            if (!restaurante.getId().equals(mov.getRestaurante().getId())) continue;
            Long uid = mov.getUsuario().getId();
            if (mov.getPuntos() > 0) {
                ultimaVisita.merge(uid, mov.getFecha(), (a, b) -> a.isAfter(b) ? a : b);
                visitas.merge(uid, 1, Integer::sum);
            }
        }

        LocalDateTime limite = LocalDateTime.now().minusWeeks(SEMANAS_INACTIVO);
        List<Map<String, Object>> inactivos = new ArrayList<>();
        for (Map.Entry<Long, LocalDateTime> e : new LinkedHashMap<>(ultimaVisita).entrySet()) {
            if (e.getValue().isBefore(limite)) {
                usuarioDAO.findById(e.getKey()).ifPresent(u -> inactivos.add(Map.of(
                        "id", u.getId(),
                        "nombre", u.getNombre(),
                        "puntos", u.getPuntos(),
                        "diasSinVolver", Duration.between(e.getValue(), LocalDateTime.now()).toDays()
                )));
            }
        }
        inactivos.sort((a, b) -> Long.compare((long) b.get("diasSinVolver"), (long) a.get("diasSinVolver")));

        long recurrentes = visitas.values().stream().filter(v -> v >= 2).count();

        LocalDate inicioMes = LocalDate.now().withDayOfMonth(1);
        int ganadosMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() > 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1)))
                .mapToInt(MovimientoPuntos::getPuntos).sum();
        int canjeadosMes = movimientos.stream()
                .filter(mov -> mov.getPuntos() < 0 && mov.getFecha() != null
                        && mov.getFecha().toLocalDate().isAfter(inicioMes.minusDays(1)))
                .mapToInt(MovimientoPuntos::getPuntos).sum();

        Map<String, Object> promoMasCanjeada = movimientos.stream()
                .filter(mov -> mov.getPuntos() < 0)
                .collect(Collectors.groupingBy(MovimientoPuntos::getDescripcion, Collectors.counting()))
                .entrySet().stream().max(Map.Entry.comparingByValue())
                .map(e -> Map.<String, Object>of("promocion", e.getKey(), "canjes", e.getValue()))
                .orElse(null);

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("clientesTotales", ultimaVisita.size());
        resumen.put("clientesRecurrentes", recurrentes);
        resumen.put("clientesInactivos", inactivos);
        resumen.put("ganadosMes", ganadosMes);
        resumen.put("canjeadosMes", canjeadosMes);
        resumen.put("promoMasCanjeada", promoMasCanjeada);
        resumen.put("sugerencia", sugerencia(inactivos.size(), recurrentes));
        return resumen;
    }

    private String sugerencia(int inactivos, long recurrentes) {
        if (inactivos >= 3) {
            return "Tienes " + inactivos + " clientes que no vuelven desde hace más de "
                    + SEMANAS_INACTIVO + " semanas: una promo tipo GANAR de doble puntos podría traerlos de vuelta.";
        }
        if (recurrentes >= 2) {
            return "Buen ritmo de recurrencia (" + recurrentes + " clientes fieles): una promo CANJEAR "
                    + "barata les anima a gastar sus puntos.";
        }
        return "Empieza registrando compras con el escáner: con datos de dos semanas "
                + "podremos sugerirte promociones concretas.";
    }
}
