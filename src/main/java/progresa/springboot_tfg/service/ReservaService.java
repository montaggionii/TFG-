package progresa.springboot_tfg.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminReservation;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.Set;

/**
 * Reservas de mesa: el cliente reserva desde la ficha del restaurante y
 * el restaurante las acepta o rechaza desde su panel. Reutiliza la
 * entidad AdminReservation (mismos estados PENDING/CONFIRMED/CANCELLED
 * que gestiona el panel de administración).
 */
@Service
public class ReservaService {

    private static final Set<String> ESTADOS_RESTAURANTE = Set.of("CONFIRMED", "CANCELLED");

    private final AdminReservationDAO reservaDAO;
    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;

    public ReservaService(AdminReservationDAO reservaDAO, UsuarioDAO usuarioDAO, RestauranteDAO restauranteDAO) {
        this.reservaDAO = reservaDAO;
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
    }

    public AdminReservation crear(Long restauranteId, String emailUsuario,
                                  LocalDateTime fecha, int personas, String notas) {
        if (fecha == null || fecha.isBefore(LocalDateTime.now().minusMinutes(1))) {
            throw new BadRequestException("La fecha de la reserva debe ser futura");
        }
        if (personas < 1 || personas > 20) {
            throw new BadRequestException("El número de personas debe estar entre 1 y 20");
        }
        Usuario usuario = usuarioDAO.findByEmail(emailUsuario)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        AdminReservation reserva = new AdminReservation();
        reserva.setUsuario(usuario);
        reserva.setRestaurante(restaurante);
        reserva.setClientName(usuario.getNombre());
        reserva.setClientEmail(usuario.getEmail());
        reserva.setClientPhone(usuario.getTelefono());
        reserva.setBusinessName(restaurante.getNombre());
        reserva.setDate(fecha);
        reserva.setPeople(personas);
        reserva.setStatus("PENDING");
        reserva.setNotes(notas);
        return reservaDAO.save(reserva);
    }

    public AdminReservation cancelar(Long reservaId, String emailUsuario) {
        AdminReservation reserva = requireReserva(reservaId);
        requireOwner(reserva, emailUsuario);
        if (!"PENDING".equals(reserva.getStatus()) && !"CONFIRMED".equals(reserva.getStatus())) {
            throw new BadRequestException("Esta reserva ya no se puede cancelar");
        }
        reserva.setStatus("CANCELLED");
        return reservaDAO.save(reserva);
    }

    public AdminReservation cambiarEstado(Long reservaId, String emailRestaurante, String estado) {
        String nuevo = estado == null ? "" : estado.trim().toUpperCase();
        if (!ESTADOS_RESTAURANTE.contains(nuevo)) {
            throw new BadRequestException("Estado no válido (CONFIRMED o CANCELLED)");
        }
        AdminReservation reserva = requireReserva(reservaId);
        requireRestauranteOwner(reserva, emailRestaurante);
        reserva.setStatus(nuevo);
        return reservaDAO.save(reserva);
    }

    private AdminReservation requireReserva(Long id) {
        AdminReservation reserva = reservaDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada"));
        if (Boolean.TRUE.equals(reserva.getDeleted())) {
            throw new ResourceNotFoundException("Reserva no encontrada");
        }
        return reserva;
    }

    private void requireOwner(AdminReservation reserva, String emailUsuario) {
        boolean dueño = reserva.getUsuario() != null
                && reserva.getUsuario().getEmail() != null
                && reserva.getUsuario().getEmail().equalsIgnoreCase(emailUsuario)
                || (reserva.getClientEmail() != null && reserva.getClientEmail().equalsIgnoreCase(emailUsuario));
        if (!dueño) {
            throw new AccessDeniedException("No puedes operar sobre esta reserva");
        }
    }

    private void requireRestauranteOwner(AdminReservation reserva, String emailRestaurante) {
        if (reserva.getRestaurante() == null
                || reserva.getRestaurante().getEmail() == null
                || !reserva.getRestaurante().getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes operar sobre reservas de otro restaurante");
        }
    }
}
