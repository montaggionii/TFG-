package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.Promocion;

import java.util.List;

public interface PromocionDAO extends JpaRepository<Promocion, Long> {

    List<Promocion> findByRestauranteId(Long restauranteId);
}
