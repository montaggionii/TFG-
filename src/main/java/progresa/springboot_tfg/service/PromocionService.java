package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
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

    public List<Promocion> obtenerPorRestaurante(Long restauranteId) {
        return promocionDAO.findByRestauranteId(restauranteId);
    }

    public void validarRestauranteAutenticado(Long restauranteId, String emailRestaurante) {
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
        if (emailRestaurante == null || !restaurante.getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes consultar promociones de otro restaurante");
        }
    }

    public Promocion actualizar(Long promocionId, Promocion actualizada, String emailRestaurante) {
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);

        promocion.setTitulo(actualizada.getTitulo());
        promocion.setDescripcion(actualizada.getDescripcion());
        promocion.setPuntosOtorgados(actualizada.getPuntosOtorgados());

        return promocionDAO.save(promocion);
    }

    public void eliminar(Long promocionId, String emailRestaurante) {
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);
        promocionDAO.delete(promocion);
    }

    public void aplicarPromocion(Long promocionId, Long usuarioId, String emailRestaurante) {

        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);

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
        mov.setRestaurante(promocion.getRestaurante());
        mov.setPuntos(promocion.getPuntosOtorgados());
        mov.setTipo("GANADOS");
        mov.setDescripcion("Promoción aplicada");

        movimientoPuntosDAO.save(mov);
    }

    private void requirePromotionOwner(Promocion promocion, String emailRestaurante) {
        if (promocion.getRestaurante() == null
                || emailRestaurante == null
                || !promocion.getRestaurante().getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes operar sobre promociones de otro restaurante");
        }
    }
}
