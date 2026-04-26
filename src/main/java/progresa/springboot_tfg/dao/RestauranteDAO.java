package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.Restaurante;
import java.util.Optional;

public interface RestauranteDAO extends JpaRepository<Restaurante, Long> {

    Optional<Restaurante> findByEmail(String email);
}
