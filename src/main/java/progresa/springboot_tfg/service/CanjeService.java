package progresa.springboot_tfg.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import progresa.springboot_tfg.dao.CanjeDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Canje;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Validación de canjes en el mostrador. El flujo completo:
 *
 *  1. El cliente canjea la promoción (se descuentan los puntos al
 *     momento, para que no pueda gastar dos veces el mismo saldo).
 *  2. Recibe un QR temporal ({@code CANJE:<id>:<token>}) válido 10
 *     minutos: ni un pantallazo ni un reenvío sirven después.
 *  3. El restaurante escanea ese QR y valida el canje.
 *  4. Si nadie lo valida, el cliente puede cancelarlo y recupera los
 *     puntos (también cuando ya ha caducado el token).
 */
@Service
public class CanjeService {

    public static final Duration TTL_TOKEN = Duration.ofMinutes(10);

    private final CanjeDAO canjeDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public CanjeService(CanjeDAO canjeDAO, UsuarioDAO usuarioDAO, MovimientoPuntosDAO movimientoPuntosDAO) {
        this.canjeDAO = canjeDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }

    /** Código que codifica el QR del cliente: CANJE:<id>:<token>. */
    public String codigoDe(Canje canje) {
        return "CANJE:" + canje.getId() + ":" + canje.getToken();
    }

    /**
     * El restaurante valida el QR escaneado. Comprueba que la promoción
     * es suya, que el canje está pendiente y que el token no ha caducado.
     */
    public Canje validar(Long canjeId, String codigoEscaneado, String emailRestaurante) {
        Canje canje = canjeDAO.findById(canjeId)
                .orElseThrow(() -> new ResourceNotFoundException("Canje no encontrado"));

        requirePromotionOwner(canje, emailRestaurante);

        if (!canje.isPendiente()) {
            throw new BadRequestException("Este canje ya no está pendiente (estado: "
                    + (canje.getEstado() == null ? "—" : canje.getEstado()) + ")");
        }
        if (codigoEscaneado == null || !codigoEscaneado.equals(codigoDe(canje))) {
            throw new BadRequestException("El código del QR no corresponde a este canje");
        }
        if (canje.getTokenExpira() != null && canje.getTokenExpira().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("El código ha caducado. Pide al cliente que vuelva a canjear.");
        }

        canje.setEstado("VALIDADO");
        canje.setFechaValidacion(LocalDateTime.now());
        return canjeDAO.save(canje);
    }

    /**
     * Cancelación por el cliente: solo si sigue pendiente. Si el token ya
     * caducó o el cliente se arrepiente, devuelve los puntos.
     */
    public Canje cancelar(Long canjeId, String emailUsuario) {
        Canje canje = canjeDAO.findById(canjeId)
                .orElseThrow(() -> new ResourceNotFoundException("Canje no encontrado"));

        Usuario usuario = canje.getUsuario();
        if (usuario == null || !usuario.getEmail().equalsIgnoreCase(emailUsuario)) {
            throw new AccessDeniedException("No puedes cancelar el canje de otro usuario");
        }
        if (!canje.isPendiente()) {
            throw new BadRequestException("Este canje ya no está pendiente");
        }

        canje.setEstado("CANCELADO");
        canje.setToken(null);
        canje.setTokenExpira(null);

        usuario.setPuntos(usuario.getPuntos() + canje.getPuntosGastados());
        usuarioDAO.save(usuario);

        MovimientoPuntos devolucion = new MovimientoPuntos();
        devolucion.setUsuario(usuario);
        devolucion.setRestaurante(canje.getPromocion().getRestaurante());
        devolucion.setPuntos(canje.getPuntosGastados());
        devolucion.setTipo("GANADOS");
        devolucion.setDescripcion("Devolución de canje no validado: " + canje.getPromocion().getTitulo());
        movimientoPuntosDAO.save(devolucion);

        return canjeDAO.save(canje);
    }

    /**
     * El cliente consulta el estado del canje mientras espera: el dueño
     * es el propio cliente o el restaurante de la promoción.
     */
    public Canje estado(Long canjeId, String email) {
        Canje canje = canjeDAO.findById(canjeId)
                .orElseThrow(() -> new ResourceNotFoundException("Canje no encontrado"));
        boolean esCliente = canje.getUsuario() != null
                && canje.getUsuario().getEmail() != null
                && canje.getUsuario().getEmail().equalsIgnoreCase(email);
        boolean esRestaurante = canje.getPromocion() != null
                && canje.getPromocion().getRestaurante() != null
                && canje.getPromocion().getRestaurante().getEmail() != null
                && canje.getPromocion().getRestaurante().getEmail().equalsIgnoreCase(email);
        if (!esCliente && !esRestaurante) {
            throw new AccessDeniedException("No puedes consultar este canje");
        }
        return canje;
    }

    private void requirePromotionOwner(Canje canje, String emailRestaurante) {
        if (canje.getPromocion() == null
                || canje.getPromocion().getRestaurante() == null
                || emailRestaurante == null
                || !canje.getPromocion().getRestaurante().getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes validar canjes de otro restaurante");
        }
    }

    /** Token aleatorio para el QR del canje. */
    public String nuevoToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
