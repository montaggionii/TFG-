package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;

import java.util.List;

public interface MovimientoPuntosDAO extends JpaRepository<MovimientoPuntos, Long> {

    List<MovimientoPuntos> findByUsuario(Usuario usuario);
}
