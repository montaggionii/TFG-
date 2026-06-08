package progresa.springboot_tfg.scratch;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import progresa.springboot_tfg.dao.UsuarioRestaurantePuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.MovimientoPuntos;

import java.util.List;

@Component
@Profile("debug")
public class DataIntegrityChecker implements CommandLineRunner {
    private final UsuarioRestaurantePuntosDAO urpDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public DataIntegrityChecker(UsuarioRestaurantePuntosDAO urpDAO, RestauranteDAO restauranteDAO, MovimientoPuntosDAO movimientoPuntosDAO) {
        this.urpDAO = urpDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("\n--- [AUDITORÍA DE DATOS DE PUNTOS] ---");
        
        System.out.println("\n1. RESTAURANTES REGISTRADOS:");
        restauranteDAO.findAll().forEach(r -> {
            System.out.println("   ID: " + r.getId() + " | Nombre: [" + r.getNombre() + "] | Email: [" + r.getEmail() + "]");
        });

        System.out.println("\n2. REGISTROS DE PUNTOS (UsuarioRestaurantePuntos):");
        urpDAO.findAll().forEach(p -> {
            System.out.println("   User: " + p.getUsuario().getId() + " | Rest: " + p.getRestaurante().getId() + " (" + p.getRestaurante().getNombre() + ") | Pts: " + p.getPuntos());
        });

        System.out.println("\n3. ÚLTIMOS 10 MOVIMIENTOS:");
        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findAll();
        movimientos.stream().sorted((a,b) -> b.getId().compareTo(a.getId())).limit(10).forEach(m -> {
            String restName = m.getRestaurante() != null ? m.getRestaurante().getNombre() : "N/A";
            Long restId = m.getRestaurante() != null ? m.getRestaurante().getId() : -1;
            System.out.println("   ID: " + m.getId() + " | User: " + m.getUsuario().getId() + " | RestID: " + restId + " (" + restName + ") | Pts: " + m.getPuntos() + " | Tipo: " + m.getTipo());
        });

        System.out.println("\n--- [FIN DE AUDITORÍA] ---\n");
    }
}
