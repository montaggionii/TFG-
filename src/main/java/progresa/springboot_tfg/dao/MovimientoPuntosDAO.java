package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;

import java.time.LocalDateTime;
import java.util.List;

public interface MovimientoPuntosDAO extends JpaRepository<MovimientoPuntos, Long> {

    List<MovimientoPuntos> findByUsuario(Usuario usuario);

    List<MovimientoPuntos> findTop10ByOrderByFechaDesc();

    long countByFechaBetween(LocalDateTime start, LocalDateTime end);
}
