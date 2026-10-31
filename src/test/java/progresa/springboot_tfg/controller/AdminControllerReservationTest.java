package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import progresa.springboot_tfg.dao.AdminLogDAO;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminReservation;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.service.RestauranteService;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * AGT-029 — el selector de estado y los botones de acción rápida del
 * formulario de reservas del panel admin (admin-reservations.component.html)
 * ofrecen PENDING/CONFIRMED/CANCELLED/COMPLETED/ATTENDED/NO_SHOW, pero
 * AdminController solo aceptaba los tres primeros: elegir "Completada",
 * "Asistió" o "No asistió" desde la UI real siempre fallaba con un 400.
 * Estos tests fijan que los seis estados que ofrece la UI son aceptados
 * tanto al crear/editar una reserva como al cambiar su estado, y que un
 * estado fuera de ese conjunto sigue rechazándose.
 */
@ExtendWith(MockitoExtension.class)
class AdminControllerReservationTest {

    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;
    @Mock
    private AdminLogDAO adminLogDAO;
    @Mock
    private AdminReservationDAO adminReservationDAO;
    @Mock
    private RestauranteService restauranteService;

    private AdminController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminController(usuarioDAO, restauranteDAO, movimientoPuntosDAO, adminLogDAO, adminReservationDAO, restauranteService);
    }

    private AdminReservation reservaPendiente() {
        AdminReservation reserva = new AdminReservation();
        reserva.setClientName("Cliente Test");
        reserva.setClientEmail("cliente@test.com");
        reserva.setBusinessName("Negocio Test");
        reserva.setStatus("PENDING");
        return reserva;
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "ATTENDED", "NO_SHOW"})
    void createReservationAceptaCualquierEstadoQueOfreceLaUi(String status) {
        when(adminReservationDAO.save(any(AdminReservation.class))).thenAnswer(inv -> inv.getArgument(0));

        var res = controller.createReservation(Map.of(
                "clientName", "Cliente Test",
                "clientEmail", "cliente@test.com",
                "businessName", "Negocio Test",
                "status", status
        ));

        assertEquals(200, res.getStatusCode().value());
        ArgumentCaptor<AdminReservation> captor = ArgumentCaptor.forClass(AdminReservation.class);
        org.mockito.Mockito.verify(adminReservationDAO).save(captor.capture());
        assertEquals(status, captor.getValue().getStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"COMPLETED", "ATTENDED", "NO_SHOW"})
    void updateReservationStatusAceptaLosEstadosQueAntesRechazabaConBadRequest(String status) {
        AdminReservation reserva = reservaPendiente();
        when(adminReservationDAO.findById(1L)).thenReturn(Optional.of(reserva));
        when(adminReservationDAO.save(any(AdminReservation.class))).thenAnswer(inv -> inv.getArgument(0));

        var res = controller.updateReservationStatus(1L, Map.of("status", status));

        assertEquals(200, res.getStatusCode().value());
        assertEquals(status, reserva.getStatus());
    }

    @Test
    void updateReservationStatusConEstadoNoValidoSigueLanzandoBadRequest() {
        AdminReservation reserva = reservaPendiente();
        when(adminReservationDAO.findById(1L)).thenReturn(Optional.of(reserva));

        assertThrows(BadRequestException.class, () -> controller.updateReservationStatus(1L, Map.of("status", "ARCHIVADA")));
        assertEquals("PENDING", reserva.getStatus(), "un estado inválido no debe mutar la reserva");
    }

    @Test
    void createReservationConEstadoNoValidoLanzaBadRequestYNoGuarda() {
        assertThrows(BadRequestException.class, () -> controller.createReservation(Map.of(
                "clientName", "Cliente Test",
                "clientEmail", "cliente@test.com",
                "businessName", "Negocio Test",
                "status", "ARCHIVADA"
        )));
        org.mockito.Mockito.verify(adminReservationDAO, org.mockito.Mockito.never()).save(any());
    }
}
