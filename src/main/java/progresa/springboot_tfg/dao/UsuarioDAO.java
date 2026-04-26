package progresa.springboot_tfg.dao;

import org.springframework.data.jpa.repository.JpaRepository;
import progresa.springboot_tfg.entity.Usuario;

import java.util.Optional;

public interface UsuarioDAO extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);
}
