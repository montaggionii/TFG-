package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioRestaurantePuntosDAO;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.List;

@Service
public class PromocionService {

    private final PromocionDAO promocionDAO;
    private final RestauranteDAO restauranteDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final UsuarioRestaurantePuntosDAO puntosDAO;

    public PromocionService(
            PromocionDAO promocionDAO,
            RestauranteDAO restauranteDAO,
            UsuarioDAO usuarioDAO,
            MovimientoPuntosDAO movimientoPuntosDAO,
            UsuarioRestaurantePuntosDAO puntosDAO
    ) {
        this.promocionDAO = promocionDAO;
        this.restauranteDAO = restauranteDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.puntosDAO = puntosDAO;
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

    public List<Promocion> obtenerPorRestaurante(Long restauranteId) {
        return promocionDAO.findByRestauranteId(restauranteId);
    }


    public void aplicarPromocion(Long promocionId, Long usuarioId) {

        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        Restaurante restaurante = promocion.getRestaurante();
        UsuarioRestaurantePuntos saldo = puntosDAO.findByUsuarioIdAndRestauranteId(usuarioId, restaurante.getId())
                .orElseGet(() -> {
                    UsuarioRestaurantePuntos nuevoSaldo = new UsuarioRestaurantePuntos();
                    nuevoSaldo.setUsuario(usuario);
                    nuevoSaldo.setRestaurante(restaurante);
                    nuevoSaldo.setPuntos(0);
                    return nuevoSaldo;
                });

        saldo.setPuntos(saldo.getPuntos() + promocion.getPuntosOtorgados());
        puntosDAO.save(saldo);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setRestaurante(restaurante);
        mov.setPuntos(promocion.getPuntosOtorgados());
        mov.setTipo("GANADOS");
        mov.setDescripcion("Promoción aplicada: " + promocion.getTitulo());

        movimientoPuntosDAO.save(mov);

        usuario.setPuntos(puntosDAO.sumarPuntosPorUsuario(usuarioId));
        usuarioDAO.save(usuario);
    }
}
