package progresa.springboot_tfg.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import java.util.Optional;

@Configuration
public class DataInitializer {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${app.admin.email:admin@fidelyfood.local}")
    private String adminEmail;

    @Value("${app.admin.password:change-me-admin-password}")
    private String adminPassword;

    @Value("${app.seed.restaurant.password:change-me-restaurant-password}")
    private String seedRestaurantPassword;

    @Bean
    CommandLineRunner initDatabase(RestauranteDAO repository, UsuarioDAO usuarioDAO, JdbcTemplate jdbcTemplate) {
        return args -> {
            prepararColumnasRole(jdbcTemplate);

            System.out.println("🚀 SEMBRADOR: Verificando restaurantes de prueba...");

            // 1. Alabroster - Comida Colombiana
            crearSiNoExiste(repository, 
                "Alabroster - Comida Colombiana", 
                39.4699, -0.3763, 
                "alabroster.jpg",
                "alabroster@test.com"
            );

            // 2. Comida venezolana
            crearSiNoExiste(repository, 
                "Venezuela Food", 
                39.4903, -0.3919, 
                "venezuela_food.png",
                "venezuelafood@gmail.com"
            );

            crearAdminSiNoExiste(usuarioDAO);

            System.out.println("✅ SEMBRADOR: Datos listos para el mapa.");
        };
    }

    private void prepararColumnasRole(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("ALTER TABLE usuarios MODIFY COLUMN role VARCHAR(32) NOT NULL");
        jdbcTemplate.execute("ALTER TABLE restaurantes MODIFY COLUMN role VARCHAR(32) NOT NULL");
        System.out.println("🛡️ MIGRACIÓN ADMIN: columnas role verificadas como VARCHAR(32)");
    }

    private void crearSiNoExiste(RestauranteDAO repository, String nombre, double lat, double lng, String img, String email) {
        Optional<Restaurante> exist = repository.findAll().stream()
                .filter(r -> r.getEmail().equalsIgnoreCase(email))
                .findFirst();

        if (exist.isEmpty()) {
            Restaurante r = new Restaurante();
            r.setNombre(nombre);
            r.setDireccion("Valencia, España");
            r.setLatitud(lat);
            r.setLongitud(lng);
            r.setImagenUrl(img);
            r.setEmail(email);
            r.setTelefono("600000000");
            r.setCiudad("Valencia");
            r.setPassword(passwordEncoder.encode(seedRestaurantPassword));
            r.setRole(Role.ROLE_RESTAURANT);
            repository.save(r);
            System.out.println("🆕 CREADO: " + nombre + " (password configurada)");
        } else {
            Restaurante r = exist.get();
            r.setLatitud(lat);
            r.setLongitud(lng);
            r.setImagenUrl(img);
            r.setEmail(email);
            r.setPassword(passwordEncoder.encode(seedRestaurantPassword));
            repository.save(r);
            System.out.println("🔄 PASSWORD RESETEADO Y VERIFICADO: " + nombre + " (password configurada)");
        }
    }

    private void crearAdminSiNoExiste(UsuarioDAO usuarioDAO) {
        Optional<Usuario> exist = usuarioDAO.findByEmail(adminEmail);

        if (exist.isEmpty()) {
            Usuario admin = new Usuario();
            admin.setNombre("Administrador FidelyFood");
            admin.setEmail(adminEmail);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setPuntos(0);
            admin.setRole(Role.ROLE_ADMIN);
            admin.setActive(true);
            usuarioDAO.save(admin);
            System.out.println("🛡️ ADMIN CREADO: " + adminEmail + " | role=ROLE_ADMIN | password=configurada");
            return;
        }

        Usuario admin = exist.get();
        boolean roleOk = Role.ROLE_ADMIN.equals(admin.getRole());
        boolean passwordOk = passwordEncoder.matches(adminPassword, admin.getPassword());
        boolean activeOk = admin.isActive();

        System.out.println("🛡️ ADMIN DIAGNÓSTICO: id=" + admin.getId()
                + " | email=" + admin.getEmail()
                + " | role=" + admin.getRole()
                + " | roleOk=" + roleOk
                + " | passwordOk=" + passwordOk
                + " | activeOk=" + activeOk);

        if (!roleOk || !passwordOk || !activeOk) {
            admin.setRole(Role.ROLE_ADMIN);
            admin.setPassword(passwordEncoder.encode(adminPassword));
            admin.setActive(true);
            usuarioDAO.save(admin);
            System.out.println("🛡️ ADMIN CORREGIDO: id=" + admin.getId()
                    + " | email=" + admin.getEmail()
                    + " | role=ROLE_ADMIN | password=reiniciada | active=true");
        } else {
            System.out.println("🛡️ ADMIN OK: " + adminEmail);
        }
    }
}
