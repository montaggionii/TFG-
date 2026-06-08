package progresa.springboot_tfg.scratch;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import progresa.springboot_tfg.dao.UsuarioRestaurantePuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;
import java.util.List;

@Component
@Profile("debug")
public class PointsDebugger implements CommandLineRunner {
    private final UsuarioRestaurantePuntosDAO urpDAO;
    private final UsuarioDAO usuarioDAO;

    public PointsDebugger(UsuarioRestaurantePuntosDAO urpDAO, UsuarioDAO usuarioDAO) {
        this.urpDAO = urpDAO;
        this.usuarioDAO = usuarioDAO;
    }

    @Override
    public void run(String... args) throws Exception {
        System.out.println("============== POINTS DEBUG DUMP ==============");
        usuarioDAO.findAll().forEach(u -> {
            System.out.println("Usuario: " + u.getId() + " - " + u.getNombre() + " (Global Legacy Pts: " + u.getPuntos() + ")");
            List<UsuarioRestaurantePuntos> points = urpDAO.findByUsuarioId(u.getId());
            points.forEach(p -> {
                System.out.println("  -> Rest: " + p.getRestaurante().getId() + " (" + p.getRestaurante().getNombre() + "): " + p.getPuntos() + " pts");
            });
        });
        System.out.println("===============================================");
    }
}
