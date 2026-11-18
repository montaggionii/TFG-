package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.Favorito;

import java.util.List;
import java.util.Optional;

public interface FavoritoDAO extends JpaRepository<Favorito, Long> {

    List<Favorito> findByUsuarioId(Long usuarioId);

    Optional<Favorito> findByUsuarioIdAndRestauranteId(Long usuarioId, Long restauranteId);

    boolean existsByUsuarioIdAndRestauranteId(Long usuarioId, Long restauranteId);

    void deleteByUsuarioIdAndRestauranteId(Long usuarioId, Long restauranteId);
}
