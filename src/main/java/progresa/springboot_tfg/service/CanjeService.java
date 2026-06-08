package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import progresa.springboot_tfg.dao.*;
import progresa.springboot_tfg.entity.*;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.Map;

@Service
public class CanjeService {

    private final CanjeDAO canjeDAO;
    private final PromocionDAO promocionDAO;
    private final UsuarioDAO usuarioDAO;
    private final UsuarioRestaurantePuntosDAO puntosDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public CanjeService(
            CanjeDAO canjeDAO,
            PromocionDAO promocionDAO,
            UsuarioDAO usuarioDAO,
            UsuarioRestaurantePuntosDAO puntosDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.canjeDAO = canjeDAO;
        this.promocionDAO = promocionDAO;
        this.usuarioDAO = usuarioDAO;
        this.puntosDAO = puntosDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    @Transactional
    public Map<String, Object> canjearPromocion(Long usuarioId, Long promocionId) {
        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() -> new ResourceNotFoundException("Promoción no encontrada"));

        if (!esCanje(promocion.getTipo())) {
            throw new BadRequestException("Esta promoción es para ganar puntos, no para canjear");
        }

        Restaurante restaurante = promocion.getRestaurante();
        int puntosNecesarios = promocion.getPuntosNecesarios();

        UsuarioRestaurantePuntos saldo = puntosDAO.findByUsuarioIdAndRestauranteId(usuarioId, restaurante.getId())
                .orElseThrow(() -> new BadRequestException("El usuario no tiene puntos en este restaurante"));

        int puntosAntes = saldo.getPuntos();
        if (puntosAntes < puntosNecesarios) {
            throw new BadRequestException("Puntos insuficientes para este restaurante");
        }

        saldo.setPuntos(puntosAntes - puntosNecesarios);
        puntosDAO.save(saldo);

        Canje canje = new Canje();
        canje.setUsuario(usuario);
        canje.setPromocion(promocion);
        canje.setPuntosCanjeados(puntosNecesarios);
        Canje canjeGuardado = canjeDAO.save(canje);

        MovimientoPuntos movimiento = new MovimientoPuntos();
        movimiento.setUsuario(usuario);
        movimiento.setRestaurante(restaurante);
        movimiento.setPuntos(puntosNecesarios);
        movimiento.setTipo("CANJEADOS");
        movimiento.setDescripcion("Canje de promoción: " + promocion.getTitulo() + " en " + restaurante.getNombre());
        movimientoPuntosDAO.save(movimiento);

        int saldoGlobal = puntosDAO.sumarPuntosPorUsuario(usuarioId);
        usuario.setPuntos(saldoGlobal);
        usuarioDAO.save(usuario);

        return Map.of(
                "codigo", "CANJE-" + canjeGuardado.getId(),
                "puntosAntes", puntosAntes,
                "puntosUsados", puntosNecesarios,
                "saldoActual", saldo.getPuntos(),
                "saldoRestaurante", saldo.getPuntos(),
                "saldoGlobal", saldoGlobal,
                "restaurante", restaurante.getNombre(),
                "recompensa", promocion.getTitulo()
        );
    }

    private boolean esCanje(String tipo) {
        return tipo != null && tipo.trim().equalsIgnoreCase("CANJEAR");
    }
}
