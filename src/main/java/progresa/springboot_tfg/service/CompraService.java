package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

@Service
public class CompraService {

    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public CompraService(
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    public void registrarCompra(Long usuarioId, double importe, String emailRestaurante) {
        if (importe <= 0) {
            throw new BadRequestException("El importe debe ser mayor que cero");
        }

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));
        Restaurante restaurante = restauranteDAO.findByEmail(emailRestaurante)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        int puntos = (int) importe; // 1€ = 1 punto
        if (puntos <= 0) {
            throw new BadRequestException("La compra no genera puntos suficientes");
        }

        // sumar puntos
        usuario.setPuntos(usuario.getPuntos() + puntos);
        usuarioDAO.save(usuario);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setRestaurante(restaurante);
        mov.setPuntos(puntos);
        mov.setTipo("GANADOS");
        mov.setMonto(importe);
        mov.setDescripcion("Compra realizada en " + restaurante.getNombre() + ": " + importe + "€");

        movimientoPuntosDAO.save(mov);
    }
}
