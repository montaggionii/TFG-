package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.MovimientoPuntosDTO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.List;

@Service
public class MovimientoPuntosService {

    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final UsuarioDAO usuarioDAO;

    public MovimientoPuntosService(
            MovimientoPuntosDAO movimientoPuntosDAO,
            UsuarioDAO usuarioDAO
    ) {
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.usuarioDAO = usuarioDAO;
    }

    /**
     * Obtiene el historial completo de movimientos (ganados y canjeados)
     * del usuario autenticado, identificado por su email.
     */
    public List<MovimientoPuntosDTO> obtenerHistorialUsuario(String email) {

        Usuario usuario = usuarioDAO.findByEmail(email)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        List<MovimientoPuntos> movimientos =
                movimientoPuntosDAO.findByUsuario(usuario);

        return movimientos.stream()
                .map(m -> new MovimientoPuntosDTO(
                        m.getPuntos(),
                        m.getTipo(),
                        m.getDescripcion(),
                        m.getFecha()
                ))
                .toList();
    }
}
