package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import progresa.springboot_tfg.dao.AdminLogDAO;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.AdminLog;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.service.RestauranteService;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-036 señaló que, tras cubrir el ajuste de puntos (AdminControllerPointsTest)
 * y las reservas (AdminControllerReservationTest), el resto de AdminController
 * (alta/edición/borrado lógico de negocios y clientes) seguía sin ningún test
 * propio. {@code /api/admin/**} ya está restringido a ROLE_ADMIN en
 * SecurityConfig, así que estos tests no buscan autorización por rol, sino la
 * lógica propia del controlador: validación de datos, protección contra editar
 * o borrar una cuenta administradora o ya eliminada (ensureEditableClient), y
 * que el borrado definitivo de clientes siga permanentemente deshabilitado.
 */
@ExtendWith(MockitoExtension.class)
class AdminControllerBusinessAndClientTest {

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
        // lenient: solo las hace falta updateBusiness (reconstruye la respuesta vía businessDetail)
        lenient().when(adminReservationDAO.findByDeletedFalseOrderByDateDesc()).thenReturn(java.util.List.of());
        lenient().when(movimientoPuntosDAO.findAll()).thenReturn(java.util.List.of());
        lenient().when(adminLogDAO.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(any(), any())).thenReturn(java.util.List.of());
    }

    private Restaurante negocio(long id, String nombre, String email) {
        Restaurante restaurante = new Restaurante();
        restaurante.setId(id);
        restaurante.setNombre(nombre);
        restaurante.setEmail(email);
        restaurante.setRole(Role.ROLE_RESTAURANT);
        restaurante.setActive(true);
        restaurante.setDeleted(false);
        return restaurante;
    }

    private Usuario cliente(long id, String nombre, String email) {
        Usuario usuario = new Usuario(nombre, email, "hash", 0);
        usuario.setId(id);
        usuario.setRole(Role.ROLE_USER);
        usuario.setActive(true);
        usuario.setDeleted(false);
        return usuario;
    }

    // ---- businesses ----

    @Test
    void updateBusinessActualizaCamposYNormalizaElEmail() {
        Restaurante negocio = negocio(1L, "Alabroster", "old@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));
        when(restauranteDAO.existsByEmailAndIdNot("new@alabroster.com", 1L)).thenReturn(false);
        when(restauranteDAO.save(any(Restaurante.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.updateBusiness(1L, Map.of("nombre", "Alabroster 2", "email", "  New@Alabroster.com  "));

        assertEquals("Alabroster 2", negocio.getNombre());
        assertEquals("new@alabroster.com", negocio.getEmail());
        verify(adminLogDAO).save(any(AdminLog.class));
    }

    @Test
    void updateBusinessConEmailInvalidoLanzaBadRequestYNoGuardaNada() {
        Restaurante negocio = negocio(1L, "Alabroster", "old@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));

        assertThrows(BadRequestException.class, () -> controller.updateBusiness(1L, Map.of("email", "no-es-un-email")));

        verify(restauranteDAO, never()).save(any());
    }

    @Test
    void updateBusinessConEmailYaUsadoPorOtroNegocioLanzaDuplicateResource() {
        Restaurante negocio = negocio(1L, "Alabroster", "old@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));
        when(restauranteDAO.existsByEmailAndIdNot("otro@negocio.com", 1L)).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> controller.updateBusiness(1L, Map.of("email", "otro@negocio.com")));

        verify(restauranteDAO, never()).save(any());
    }

    @Test
    void updateBusinessConNombreVacioLanzaBadRequest() {
        Restaurante negocio = negocio(1L, "Alabroster", "old@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));
        when(restauranteDAO.existsByEmailAndIdNot("old@alabroster.com", 1L)).thenReturn(false);

        assertThrows(BadRequestException.class, () -> controller.updateBusiness(1L, Map.of("nombre", "   ")));

        verify(restauranteDAO, never()).save(any());
    }

    @Test
    void updateBusinessSobreUnNegocioInexistenteLanza404() {
        when(restauranteDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.updateBusiness(99L, Map.of("nombre", "x")));
    }

    @Test
    void updateBusinessSobreUnNegocioYaEliminadoLanzaBadRequest() {
        Restaurante negocio = negocio(1L, "Alabroster", "old@alabroster.com");
        negocio.setDeleted(true);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));

        assertThrows(BadRequestException.class, () -> controller.updateBusiness(1L, Map.of("nombre", "x")));
        verify(restauranteDAO, never()).save(any());
    }

    @Test
    void resetBusinessPasswordDelegaEnElServicioConElIdYLaPasswordDelCuerpo() {
        Restaurante negocio = negocio(1L, "Alabroster", "a@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));

        ResponseEntity<?> res = controller.resetBusinessPassword(1L, Map.of("password", "unaPasswordNueva123"));

        assertEquals(200, res.getStatusCode().value());
        verify(restauranteService).restablecerPasswordComoAdmin(1L, "unaPasswordNueva123");
        verify(adminLogDAO).save(any(AdminLog.class));
    }

    @Test
    void resetBusinessPasswordSobreUnNegocioInexistenteLanza404YNoLlamaAlServicio() {
        when(restauranteDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.resetBusinessPassword(99L, Map.of("password", "x")));
        verify(restauranteService, never()).restablecerPasswordComoAdmin(anyLong(), any());
    }

    @Test
    void setBusinessStatusDesactivaYActivaCorrectamenteConSuLog() {
        Restaurante negocio = negocio(1L, "Alabroster", "a@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));
        when(restauranteDAO.save(any(Restaurante.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.setBusinessStatus(1L, Map.of("active", false));
        assertFalse(negocio.getActive());

        controller.setBusinessStatus(1L, Map.of("active", true));
        assertTrue(negocio.getActive());

        ArgumentCaptor<AdminLog> captor = ArgumentCaptor.forClass(AdminLog.class);
        verify(adminLogDAO, times(2)).save(captor.capture());
        assertEquals("BUSINESS_DEACTIVATED", captor.getAllValues().get(0).getAction());
        assertEquals("BUSINESS_ACTIVATED", captor.getAllValues().get(1).getAction());
    }

    @Test
    void softDeleteBusinessMarcaEliminadoYDesactivado() {
        Restaurante negocio = negocio(1L, "Alabroster", "a@alabroster.com");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));
        when(restauranteDAO.save(any(Restaurante.class))).thenAnswer(inv -> inv.getArgument(0));

        controller.softDeleteBusiness(1L);

        assertTrue(negocio.getDeleted());
        assertFalse(negocio.getActive());
        assertEquals("admin@fidelyfood.local", negocio.getDeletedByAdminEmail());
        verify(adminLogDAO).save(any(AdminLog.class));
    }

    @Test
    void softDeleteBusinessYaEliminadoLanza400SinVolverAGuardar() {
        Restaurante negocio = negocio(1L, "Alabroster", "a@alabroster.com");
        negocio.setDeleted(true);
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(negocio));

        assertThrows(BadRequestException.class, () -> controller.softDeleteBusiness(1L));
        verify(restauranteDAO, never()).save(any());
    }

    // ---- clients ----

    @Test
    void updateClientActualizaCamposYNormalizaElEmail() {
        Usuario usuario = cliente(1L, "Cliente", "old@cliente.com");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.existsByEmailAndIdNot("new@cliente.com", 1L)).thenReturn(false);
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(usuario)).thenReturn(java.util.List.of());
        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(java.util.List.of());

        controller.updateClient(1L, Map.of("nombre", "Cliente 2", "email", "  New@Cliente.com  "));

        assertEquals("Cliente 2", usuario.getNombre());
        assertEquals("new@cliente.com", usuario.getEmail());
        verify(adminLogDAO).save(any(AdminLog.class));
    }

    @Test
    void updateClientSobreUnaCuentaAdminLanzaBadRequestYNoGuardaNada() {
        Usuario admin = cliente(1L, "Admin", "admin@fidelyfood.local");
        admin.setRole(Role.ROLE_ADMIN);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(admin));

        assertThrows(BadRequestException.class, () -> controller.updateClient(1L, Map.of("nombre", "Nuevo")));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void updateClientSobreUnClienteYaEliminadoLanzaBadRequest() {
        Usuario usuario = cliente(1L, "Cliente", "cliente@test.com");
        usuario.setDeleted(true);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));

        assertThrows(BadRequestException.class, () -> controller.updateClient(1L, Map.of("nombre", "Nuevo")));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void updateClientConEmailYaUsadoPorOtroClienteLanzaDuplicateResource() {
        Usuario usuario = cliente(1L, "Cliente", "cliente@test.com");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.existsByEmailAndIdNot("otro@test.com", 1L)).thenReturn(true);

        assertThrows(DuplicateResourceException.class, () -> controller.updateClient(1L, Map.of("email", "otro@test.com")));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void setClientStatusActivaYDesactivaConSuLogYBloqueaCuentasAdmin() {
        Usuario usuario = cliente(1L, "Cliente", "cliente@test.com");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(usuario)).thenReturn(java.util.List.of());
        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(java.util.List.of());

        controller.setClientStatus(1L, Map.of("active", false));
        assertFalse(usuario.getActive());

        ArgumentCaptor<AdminLog> captor = ArgumentCaptor.forClass(AdminLog.class);
        verify(adminLogDAO).save(captor.capture());
        assertEquals("CLIENT_DEACTIVATED", captor.getValue().getAction());
    }

    @Test
    void setClientStatusSobreUnaCuentaAdminLanzaBadRequest() {
        Usuario admin = cliente(1L, "Admin", "admin@fidelyfood.local");
        admin.setRole(Role.ROLE_ADMIN);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(admin));

        assertThrows(BadRequestException.class, () -> controller.setClientStatus(1L, Map.of("active", false)));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void softDeleteClientMarcaEliminadoYRegistraQuienLoHizo() {
        Usuario usuario = cliente(1L, "Cliente", "cliente@test.com");
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuario));
        when(usuarioDAO.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));
        when(movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(usuario)).thenReturn(java.util.List.of());
        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(java.util.List.of());

        controller.softDeleteClient(1L);

        assertTrue(usuario.getDeleted());
        assertFalse(usuario.getActive());
        assertEquals("admin@fidelyfood.local", usuario.getDeletedByAdminEmail());
    }

    @Test
    void softDeleteClientSobreUnaCuentaAdminLanzaBadRequestYNoLoEliminaNunca() {
        Usuario admin = cliente(1L, "Admin", "admin@fidelyfood.local");
        admin.setRole(Role.ROLE_ADMIN);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(admin));

        assertThrows(BadRequestException.class, () -> controller.softDeleteClient(1L));
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void hardDeleteClientSigueSiempreDeshabilitadoInclusoConLaConfirmacionCorrecta() {
        assertThrows(BadRequestException.class, () -> controller.hardDeleteClient(1L, "DELETE_PERMANENTLY"));
        verify(usuarioDAO, never()).findById(any());
        verify(usuarioDAO, never()).save(any());
    }

    @Test
    void hardDeleteClientSinLaConfirmacionExactaLanzaBadRequest() {
        assertThrows(BadRequestException.class, () -> controller.hardDeleteClient(1L, "borrar"));
        assertThrows(BadRequestException.class, () -> controller.hardDeleteClient(1L, null));
    }
}
