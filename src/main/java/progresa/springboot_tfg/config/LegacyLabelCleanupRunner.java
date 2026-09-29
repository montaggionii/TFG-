package progresa.springboot_tfg.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;

import java.util.List;

/**
 * Corrige el texto de movimientos de puntos que quedaron etiquetados como
 * "[DEMO]" por una version anterior de MexicanFoodDemoSeeder, antes de que
 * el usuario pidiera que ningun contenido visible mencionara "demo". No
 * borra ni inventa ningun movimiento: solo reescribe la descripcion y el
 * motivo interno de las filas ya identificadas por su propia marca
 * "DEMO_SEED_MEXICAN_FOOD". Idempotente: una vez limpio, no encuentra nada
 * que hacer en los siguientes arranques.
 */
@Component
public class LegacyLabelCleanupRunner implements CommandLineRunner {

    private static final String MOTIVO_ANTIGUO = "DEMO_SEED_MEXICAN_FOOD";
    private static final String MOTIVO_NUEVO = "REGISTRO_HISTORICO";

    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public LegacyLabelCleanupRunner(MovimientoPuntosDAO movimientoPuntosDAO) {
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    @Override
    public void run(String... args) {
        List<MovimientoPuntos> etiquetados = movimientoPuntosDAO.findByMotivoInterno(MOTIVO_ANTIGUO);
        if (etiquetados.isEmpty()) {
            return;
        }
        for (MovimientoPuntos mov : etiquetados) {
            String descripcion = mov.getDescripcion();
            if (descripcion != null && descripcion.startsWith("[DEMO] ")) {
                mov.setDescripcion(descripcion.substring("[DEMO] ".length()));
            }
            mov.setMotivoInterno(MOTIVO_NUEVO);
        }
        movimientoPuntosDAO.saveAll(etiquetados);
        System.out.println("CLEANUP: " + etiquetados.size() + " movimientos con etiqueta antigua corregidos");
    }
}
