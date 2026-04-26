package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.List;

@Service
public class PromocionService {

    private final PromocionDAO promocionDAO;
    private final RestauranteDAO restauranteDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public PromocionService(
            PromocionDAO promocionDAO,
            RestauranteDAO restauranteDAO,
            UsuarioDAO usuarioDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.promocionDAO = promocionDAO;
        this.restauranteDAO = restauranteDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }


    public Promocion crear(Promocion promocion, String emailRestaurante) {

        Restaurante restaurante = restauranteDAO.findByEmail(emailRestaurante)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        promocion.setRestaurante(restaurante);

        return promocionDAO.save(promocion);
    }


    public List<Promocion> obtenerTodas() {
        return promocionDAO.findAll();
    }


    public void aplicarPromocion(Long promocionId, Long usuarioId) {

        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        // sumar puntos
        usuario.setPuntos(
                usuario.getPuntos() + promocion.getPuntosOtorgados()
        );
        usuarioDAO.save(usuario);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setPuntos(promocion.getPuntosOtorgados());
        mov.setTipo("GANADOS");
        mov.setDescripcion("Promoción aplicada");

        movimientoPuntosDAO.save(mov);
    }
}
