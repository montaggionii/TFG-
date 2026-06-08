package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;

import java.util.Optional;

public interface UsuarioRestaurantePuntosDAO extends JpaRepository<UsuarioRestaurantePuntos, Long> {

    Optional<UsuarioRestaurantePuntos> findByUsuarioIdAndRestauranteId(Long usuarioId, Long restauranteId);

    @Query("select coalesce(sum(urp.puntos), 0) from UsuarioRestaurantePuntos urp where urp.usuario.id = :usuarioId")
    int sumarPuntosPorUsuario(@Param("usuarioId") Long usuarioId);
}
