package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

@Service
public class CompraService {

    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public CompraService(
            UsuarioDAO usuarioDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    public void registrarCompra(Long usuarioId, double importe) {

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        int puntos = (int) importe; // 1€ = 1 punto

        // sumar puntos
        usuario.setPuntos(usuario.getPuntos() + puntos);
        usuarioDAO.save(usuario);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setPuntos(puntos);
        mov.setTipo("GANADOS");
        mov.setDescripcion("Compra realizada: " + importe + "€");

        movimientoPuntosDAO.save(mov);
    }
}
