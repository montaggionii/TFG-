package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.RecompensaDAO;
import progresa.springboot_tfg.entity.Recompensa;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;


import java.util.List;

@Service
public class RecompensaService {

    private final RecompensaDAO recompensaDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public RecompensaService(
            RecompensaDAO recompensaDAO,
            UsuarioDAO usuarioDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.recompensaDAO = recompensaDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }



    public Recompensa crear(Recompensa recompensa) {
        return recompensaDAO.save(recompensa);
    }

    public List<Recompensa> obtenerTodas() {
        return recompensaDAO.findAll();
    }

    public Recompensa obtenerPorId(Long id) {
        return recompensaDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Recompensa no encontrada"));
    }

    public Recompensa actualizar(Long id, Recompensa actualizada) {

        Recompensa recompensa = obtenerPorId(id);

        recompensa.setNombre(actualizada.getNombre());
        recompensa.setDescripcion(actualizada.getDescripcion());
        recompensa.setPuntosNecesarios(actualizada.getPuntosNecesarios());

        return recompensaDAO.save(recompensa);
    }

    public void eliminar(Long id) {
        recompensaDAO.deleteById(id);
    }

    public void canjearRecompensa(Long recompensaId, String emailUsuario) {

        Usuario usuario = usuarioDAO.findByEmail(emailUsuario)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        Recompensa recompensa = obtenerPorId(recompensaId);

        if (usuario.getPuntos() < recompensa.getPuntosNecesarios()) {
            throw new RuntimeException("Puntos insuficientes para canjear la recompensa");
        }

        // restar puntos
        usuario.setPuntos(
                usuario.getPuntos() - recompensa.getPuntosNecesarios()
        );
        usuarioDAO.save(usuario);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setPuntos(-recompensa.getPuntosNecesarios());
        mov.setTipo("CANJEADOS");
        mov.setDescripcion("Canje de recompensa: " + recompensa.getNombre());

        movimientoPuntosDAO.save(mov);
    }

}
