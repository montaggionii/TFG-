package progresa.springboot_tfg.service;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import progresa.springboot_tfg.dao.UsuarioRestaurantePuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.MovimientoPuntos;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
public class DataMigrationService implements CommandLineRunner {

    private final UsuarioRestaurantePuntosDAO urpDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public DataMigrationService(UsuarioRestaurantePuntosDAO urpDAO, RestauranteDAO restauranteDAO, MovimientoPuntosDAO movimientoPuntosDAO) {
        this.urpDAO = urpDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("🚀 [MIGRACIÓN] Iniciando verificación de integridad de puntos...");
        unificarRestaurantesDuplicados();
        System.out.println("✅ [MIGRACIÓN] Verificación completada.");
    }

    @Transactional
    public void unificarRestaurantesDuplicados() {
        List<Restaurante> restaurantes = restauranteDAO.findAll();
        if (restaurantes.isEmpty()) return;

        // Mapa para detectar el restaurante "Maestro" por cada identidad (Email o Nombre Normalizado)
        Map<String, Restaurante> identidadAMaestro = new HashMap<>();

        for (Restaurante r : restaurantes) {
            String identidad = r.getEmail().trim().toLowerCase();
            if (identidad.isEmpty()) identidad = r.getNombre().trim().toLowerCase();

            if (!identidadAMaestro.containsKey(identidad)) {
                identidadAMaestro.put(identidad, r);
            } else {
                Restaurante maestro = identidadAMaestro.get(identidad);
                if (!maestro.getId().equals(r.getId())) {
                    System.out.println("⚠️ [MIGRACIÓN] Detectado duplicado: ID " + r.getId() + " (" + r.getNombre() + ") -> ID Maestro " + maestro.getId());
                    migrarDatos(r.getId(), maestro.getId());
                }
            }
        }
        
        // Caso especial: Venezuela food vs Comida venezolana (si tienen emails distintos pero son lo mismo)
        // Buscamos específicamente el restaurante 1
        Restaurante rest1 = restauranteDAO.findById(1L).orElse(null);
        if (rest1 != null) {
            String name1 = rest1.getNombre().toLowerCase();
            for (Restaurante r : restaurantes) {
                if (r.getId() == 1L) continue;
                String n = r.getNombre().toLowerCase();
                if (n.contains("venezuela") || n.contains("food") || n.contains("comida")) {
                    // Si el nombre es muy similar, migramos
                    if (n.contains("venezuela") && name1.contains("venezuela")) {
                        System.out.println("🔍 [MIGRACIÓN] Detectada coincidencia por nombre fuzzy: " + r.getNombre() + " -> " + rest1.getNombre());
                        migrarDatos(r.getId(), 1L);
                    }
                }
            }
        }
    }

    @Transactional
    public void migrarDatos(Long fromRestId, Long toRestId) {
        System.out.println("🛠️ [MIGRACIÓN] Migrando datos de ID " + fromRestId + " a ID " + toRestId);
        
        Restaurante targetRest = restauranteDAO.findById(toRestId).orElse(null);
        if (targetRest == null) return;

        // 1. Migrar saldos (UsuarioRestaurantePuntos)
        List<UsuarioRestaurantePuntos> saldosOld = urpDAO.findAll().stream()
                .filter(u -> u.getRestaurante().getId().equals(fromRestId))
                .collect(Collectors.toList());

        for (UsuarioRestaurantePuntos old : saldosOld) {
            Long userId = old.getUsuario().getId();
            UsuarioRestaurantePuntos target = urpDAO.findByUsuarioIdAndRestauranteId(userId, toRestId).orElse(null);
            
            if (target == null) {
                // Si no tiene saldo en el nuevo ID, lo creamos
                old.setRestaurante(targetRest);
                urpDAO.save(old);
                System.out.println("   -> Saldo de " + old.getPuntos() + " pts movido para usuario " + userId);
            } else {
                // Si ya tiene saldo, sumamos
                target.setPuntos(target.getPuntos() + old.getPuntos());
                urpDAO.save(target);
                urpDAO.delete(old);
                System.out.println("   -> Saldo unificado: " + target.getPuntos() + " pts para usuario " + userId);
            }
        }

        // 2. Migrar movimientos
        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findAll().stream()
                .filter(m -> m.getRestaurante() != null && m.getRestaurante().getId().equals(fromRestId))
                .collect(Collectors.toList());

        for (MovimientoPuntos m : movimientos) {
            m.setRestaurante(targetRest);
            movimientoPuntosDAO.save(m);
        }
        System.out.println("   -> " + movimientos.size() + " movimientos actualizados.");
    }
}
