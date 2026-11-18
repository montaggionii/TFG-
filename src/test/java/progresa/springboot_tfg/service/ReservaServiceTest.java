package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminReservation;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Reservas de mesa: fecha futura, cupo de personas, ownership por email
 * (el cliente cancela solo lo suyo; el restaurante solo toca sus reservas)
 * y estados limitados a los del panel de administración.
 */
@ExtendWith(MockitoExtension.class)
class ReservaServiceTest {

    @Mock
    private AdminReservationDAO reservaDAO;
    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private RestauranteDAO restauranteDAO;

    private ReservaService reservaService;

    private Usuario usuario;
    private Restaurante restaurante;

    @BeforeEach
    void setUp() {
        reservaService = new ReservaService(reservaDAO, usuarioDAO, restauranteDAO);
        usuario = new Usuario();
        usuario.setId(7L);
        usuario.setNombre("Cliente");
        usuario.setEmail("cliente@test.com");
        restaurante = new Restaurante();
        restaurante.setId(4L);
        restaurante.setEmail("resto@test.com");
        restaurante.setNombre("La Prueba");
    }

    private AdminReservation reserva(String estado) {
        AdminReservation r = new AdminReservation();
        r.setUsuario(usuario);
        r.setRestaurante(restaurante);
        r.setClientEmail("cliente@test.com");
        r.setStatus(estado);
        r.setDate(LocalDateTime.now().plusDays(1));
        r.setPeople(4);
        return r;
    }

    @Test
    void crearReservaValidaQuedaPendiente() {
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findById(4L)).thenReturn(Optional.of(restaurante));
        when(reservaDAO.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AdminReservation r = reservaService.crear(4L, "cliente@test.com",
                LocalDateTime.now().plusDays(1), 4, "mesa tranquila");

        assertEquals("PENDING", r.getStatus());
        assertEquals(4, r.getPeople());
        assertEquals("Cliente", r.getClientName());
    }

    @Test
    void crearReservaEnElPasadoLanzaBadRequest() {
        assertThrows(BadRequestException.class, () ->
                reservaService.crear(4L, "cliente@test.com", LocalDateTime.now().minusHours(1), 2, null));
    }

    @Test
    void crearReservaConCeroPersonasLanzaBadRequest() {
        assertThrows(BadRequestException.class, () ->
                reservaService.crear(4L, "cliente@test.com", LocalDateTime.now().plusDays(1), 0, null));
        assertThrows(BadRequestException.class, () ->
                reservaService.crear(4L, "cliente@test.com", LocalDateTime.now().plusDays(1), 50, null));
    }

    @Test
    void clienteCancelaSuReserva() {
        AdminReservation r = reserva("PENDING");
        when(reservaDAO.findById(1L)).thenReturn(Optional.of(r));
        when(reservaDAO.save(r)).thenReturn(r);

        assertEquals("CANCELLED", reservaService.cancelar(1L, "cliente@test.com").getStatus());
    }

    @Test
    void otroUsuarioNoPuedeCancelarResenaAjena() {
        when(reservaDAO.findById(1L)).thenReturn(Optional.of(reserva("PENDING")));

        assertThrows(AccessDeniedException.class, () -> reservaService.cancelar(1L, "otro@test.com"));
    }

    @Test
    void restauranteConfirmaSuReserva() {
        AdminReservation r = reserva("PENDING");
        when(reservaDAO.findById(1L)).thenReturn(Optional.of(r));
        when(reservaDAO.save(r)).thenReturn(r);

        assertEquals("CONFIRMED", reservaService.cambiarEstado(1L, "resto@test.com", "confirmed").getStatus());
    }

    @Test
    void otroRestauranteNoPuedeConfirmar() {
        when(reservaDAO.findById(1L)).thenReturn(Optional.of(reserva("PENDING")));

        assertThrows(AccessDeniedException.class,
                () -> reservaService.cambiarEstado(1L, "otro@test.com", "CONFIRMED"));
    }

    @Test
    void estadoInvalidoLanzaBadRequest() {
        assertThrows(BadRequestException.class,
                () -> reservaService.cambiarEstado(1L, "resto@test.com", "COMPLETADA"));
    }

    @Test
    void reservaInexistenteLanzaNotFound() {
        when(reservaDAO.findById(99L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> reservaService.cancelar(99L, "cliente@test.com"));
    }
}
