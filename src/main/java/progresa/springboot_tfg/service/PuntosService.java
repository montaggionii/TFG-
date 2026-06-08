package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dao.UsuarioRestaurantePuntosDAO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.entity.UsuarioRestaurantePuntos;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

@Service
public class PuntosService {

    private final UsuarioRestaurantePuntosDAO puntosDAO;
    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public PuntosService(
            UsuarioRestaurantePuntosDAO puntosDAO,
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.puntosDAO = puntosDAO;
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    public int obtenerPuntosPorRestaurante(Long usuarioId, Long restauranteId) {
        return puntosDAO.findByUsuarioIdAndRestauranteId(usuarioId, restauranteId)
                .map(UsuarioRestaurantePuntos::getPuntos)
                .orElse(0);
    }

    public int obtenerTotalPuntos(Long usuarioId) {
        return puntosDAO.sumarPuntosPorUsuario(usuarioId);
    }

    @Transactional
    public int sumarPuntos(Long usuarioId, Long restauranteId, double monto, int puntos) {
        if (puntos <= 0) {
            throw new IllegalArgumentException("Los puntos a sumar deben ser mayores que cero");
        }

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        UsuarioRestaurantePuntos saldo = puntosDAO.findByUsuarioIdAndRestauranteId(usuarioId, restauranteId)
                .orElseGet(() -> {
                    UsuarioRestaurantePuntos nuevoSaldo = new UsuarioRestaurantePuntos();
                    nuevoSaldo.setUsuario(usuario);
                    nuevoSaldo.setRestaurante(restaurante);
                    nuevoSaldo.setPuntos(0);
                    return nuevoSaldo;
                });

        saldo.setPuntos(saldo.getPuntos() + puntos);
        puntosDAO.save(saldo);

        MovimientoPuntos movimiento = new MovimientoPuntos();
        movimiento.setUsuario(usuario);
        movimiento.setRestaurante(restaurante);
        movimiento.setMonto(monto);
        movimiento.setPuntos(puntos);
        movimiento.setTipo("GANADOS");
        movimiento.setDescripcion("Consumo en " + restaurante.getNombre() + ": " + monto + "€");
        movimientoPuntosDAO.save(movimiento);

        usuario.setPuntos(obtenerTotalPuntos(usuarioId));
        usuarioDAO.save(usuario);

        return saldo.getPuntos();
    }
}
