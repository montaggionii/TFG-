package progresa.springboot_tfg.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;

/**
 * Reconstruye los restaurantes históricos del TFG (mayo 2026), encontrados por
 * rastros indirectos (código semilla borrado + imágenes en uploads/) ya que las
 * filas originales de la base de datos no son recuperables de ningún archivo
 * (ver .agent/discoveries.md). Alabroster y Venezuela Food vienen del código
 * semilla original; Mexican Food es una reconstrucción con nombre/email nuevos,
 * ya que el original solo dejó su logo subido, no sus datos.
 */
@Component
public class HistoricalRestaurantSeeder implements CommandLineRunner {

    private final RestauranteDAO restauranteDAO;
    private final BCryptPasswordEncoder passwordEncoder;

    @Value("${app.seed.restaurant.password:change-me-restaurant-password}")
    private String seedPassword;

    public HistoricalRestaurantSeeder(RestauranteDAO restauranteDAO, BCryptPasswordEncoder passwordEncoder) {
        this.restauranteDAO = restauranteDAO;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        crearSiNoExiste("Alabroster - Comida Colombiana", "alabroster@test.com",
                "Valencia, España", "Valencia", 39.4699, -0.3763, "alabroster.jpg",
                "Restaurante de comida colombiana.");

        crearSiNoExiste("Venezuela Food", "venezuelafood@gmail.com",
                "Valencia, España", "Valencia", 39.4903, -0.3919, "venezuela_food.png",
                "Restaurante de comida venezolana.");

        crearSiNoExiste("Mexican Food", "mexicanfood@fidelyfood.local",
                "Valencia, España", "Valencia", 39.4800, -0.3800,
                "1778686469641_logo_restaurante mexicano.png",
                "Restaurante de comida mexicana. Nombre y email reconstruidos: el dato "
                        + "original solo sobrevivió como logo subido en mayo de 2026, no se "
                        + "encontró su nombre/email/contraseña real en ningún archivo.");
    }

    private void crearSiNoExiste(String nombre, String email, String direccion, String ciudad,
                                  double lat, double lng, String foto, String descripcion) {
        if (restauranteDAO.findByEmail(email).isPresent()) {
            return;
        }
        Restaurante r = new Restaurante();
        r.setNombre(nombre);
        r.setEmail(email);
        r.setDireccion(direccion);
        r.setCiudad(ciudad);
        r.setLatitud(lat);
        r.setLongitud(lng);
        r.setFoto(foto);
        r.setDescripcion(descripcion);
        r.setTelefono("600000000");
        r.setPassword(passwordEncoder.encode(seedPassword));
        r.setRole(Role.ROLE_RESTAURANT);
        restauranteDAO.save(r);
        System.out.println("SEED: restaurante creado -> " + nombre + " (" + email + ")");
    }
}
