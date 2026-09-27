package progresa.springboot_tfg.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.util.List;
import java.util.Random;
import java.util.UUID;

/**
 * Genera el historial de actividad (ventas, clientes, puntos) de Mexican
 * Food. Idempotente: si Mexican Food ya tiene algun movimiento de puntos
 * (de una ejecucion anterior o cualquier otro), no hace nada - nunca mezcla
 * ni duplica datos.
 */
@Component
public class MexicanFoodDemoSeeder implements CommandLineRunner {

    private static final String RESTAURANTE_EMAIL = "mexicanfood@fidelyfood.local";
    private static final String MOTIVO = "REGISTRO_HISTORICO";
    private static final int SEMANAS_HISTORIAL = 8;

    private final RestauranteDAO restauranteDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final BCryptPasswordEncoder passwordEncoder;

    public MexicanFoodDemoSeeder(RestauranteDAO restauranteDAO, UsuarioDAO usuarioDAO,
                                  MovimientoPuntosDAO movimientoPuntosDAO, BCryptPasswordEncoder passwordEncoder) {
        this.restauranteDAO = restauranteDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        Restaurante mexicanFood = restauranteDAO.findByEmail(RESTAURANTE_EMAIL).orElse(null);
        if (mexicanFood == null) {
            return; // el HistoricalRestaurantSeeder aun no ha corrido, o el email cambio
        }
        if (!movimientoPuntosDAO.findByRestauranteId(mexicanFood.getId()).isEmpty()) {
            return; // ya tiene movimientos (reales o de una ejecucion anterior) - no tocar
        }

        List<Usuario> clientesDemo = crearClientesDemoSiNoExisten();

        // Multiplicador de actividad por dia de la semana: fin de semana mas
        // fuerte, domingo mas flojo, entre semana moderado (pedido explicito
        // del usuario: "coherente", no un patron identico cada semana).
        Random random = new Random(20260924L); // semilla fija: mismos datos demo en cada entorno
        LocalDate hoy = LocalDate.now();
        int movimientosCreados = 0;

        for (int semanasAtras = SEMANAS_HISTORIAL - 1; semanasAtras >= 0; semanasAtras--) {
            LocalDate lunes = hoy.minusWeeks(semanasAtras).with(DayOfWeek.MONDAY);
            for (int dia = 0; dia < 7; dia++) {
                LocalDate fecha = lunes.plusDays(dia);
                if (fecha.isAfter(hoy)) continue;

                int transaccionesDelDia = transaccionesEsperadas(fecha.getDayOfWeek(), random);
                for (int t = 0; t < transaccionesDelDia; t++) {
                    Usuario cliente = clientesDemo.get(random.nextInt(clientesDemo.size()));
                    double monto = 12 + random.nextDouble() * 38; // ticket entre 12 y 50 euros
                    int puntosGanados = (int) Math.round(monto); // 1 punto por euro, coherente con el resto del sistema

                    LocalDateTime fechaHora = fecha.atTime(13 + random.nextInt(9), random.nextInt(60));

                    MovimientoPuntos ganado = new MovimientoPuntos();
                    ganado.setUsuario(cliente);
                    ganado.setRestaurante(mexicanFood);
                    ganado.setPuntos(puntosGanados);
                    ganado.setTipo("GANADOS");
                    ganado.setDescripcion("Compra en Mexican Food");
                    ganado.setMonto(Math.round(monto * 100.0) / 100.0);
                    ganado.setMotivoInterno(MOTIVO);
                    ganado.setFecha(fechaHora);
                    movimientoPuntosDAO.save(ganado);
                    movimientosCreados++;

                    cliente.setPuntos(cliente.getPuntos() + puntosGanados);

                    // ~1 de cada 5 visitas, el cliente canjea parte de sus puntos acumulados
                    if (random.nextInt(5) == 0 && cliente.getPuntos() > 30) {
                        int puntosCanjeados = Math.min(cliente.getPuntos(), 20 + random.nextInt(30));
                        MovimientoPuntos canjeado = new MovimientoPuntos();
                        canjeado.setUsuario(cliente);
                        canjeado.setRestaurante(mexicanFood);
                        canjeado.setPuntos(-puntosCanjeados);
                        canjeado.setTipo("CANJEADOS");
                        canjeado.setDescripcion("Canje de recompensa en Mexican Food");
                        canjeado.setMotivoInterno(MOTIVO);
                        canjeado.setFecha(fechaHora.plusMinutes(2));
                        movimientoPuntosDAO.save(canjeado);
                        movimientosCreados++;
                        cliente.setPuntos(cliente.getPuntos() - puntosCanjeados);
                    }
                    usuarioDAO.save(cliente);
                }
            }
        }

        System.out.println("SEED: " + movimientosCreados + " movimientos de historial creados para Mexican Food ("
                + SEMANAS_HISTORIAL + " semanas de historial)");
    }

    /** Fin de semana con mas actividad, domingo con menos, entre semana moderado. */
    private int transaccionesEsperadas(DayOfWeek dia, Random random) {
        int base = switch (dia) {
            case FRIDAY, SATURDAY -> 5;
            case SUNDAY -> 1;
            case MONDAY -> 2;
            default -> 3;
        };
        return Math.max(0, base + random.nextInt(3) - 1);
    }

    private List<Usuario> crearClientesDemoSiNoExisten() {
        String[] nombres = {
                "Lucia Fernandez", "Marco Ibanez", "Sofia Ramirez", "Diego Torres",
                "Elena Castro", "Pablo Navarro"
        };
        return java.util.stream.IntStream.range(0, nombres.length)
                .mapToObj(i -> {
                    String slug = nombres[i].toLowerCase().replace(" ", ".");
                    String email = slug + "@fidelyfood.local";
                    return usuarioDAO.findByEmail(email).orElseGet(() -> {
                        Usuario u = new Usuario();
                        u.setNombre(nombres[i]);
                        u.setEmail(email);
                        u.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
                        u.setPuntos(0);
                        u.setRole(Role.ROLE_USER);
                        u.setQrCode("FF-" + UUID.randomUUID());
                        u.setActive(true);
                        return usuarioDAO.save(u);
                    });
                })
                .toList();
    }
}
