package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MultipartFile;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura de PromocionService, sin cubrir hasta ahora (solo vivía en la
 * suite E2E, que requiere backend/frontend reales). Se centra en el mismo
 * patrón de autorización de recurso ya auditado en AGENT_TASKS.md
 * (FID-005/FID-013): ningún restaurante debe poder leer/modificar/aplicar
 * una promoción que no es suya, comprobado aquí vía `requirePromotionOwner`
 * (privado, ejercitado a través de actualizar/eliminar/aplicarPromocion).
 */
@ExtendWith(MockitoExtension.class)
class PromocionServiceTest {

    @Mock
    private PromocionDAO promocionDAO;
    @Mock
    private RestauranteDAO restauranteDAO;
    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;

    private PromocionService promocionService;

    @BeforeEach
    void setUp() {
        promocionService = new PromocionService(promocionDAO, restauranteDAO, usuarioDAO, movimientoPuntosDAO);
    }

    private Restaurante restaurante(long id, String email) {
        Restaurante r = new Restaurante();
        r.setId(id);
        r.setNombre("Mexican Food");
        r.setEmail(email);
        return r;
    }

    private Promocion promocionDe(Restaurante restaurante) {
        Promocion p = new Promocion();
        p.setId(7L);
        p.setTitulo("2x1 en tacos");
        p.setPuntosOtorgados(50);
        p.setRestaurante(restaurante);
        return p;
    }

    @Test
    void crearAsociaLaPromocionAlRestauranteAutenticadoPorEmail() {
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));
        when(promocionDAO.save(any(Promocion.class))).thenAnswer(inv -> inv.getArgument(0));

        Promocion nueva = new Promocion();
        nueva.setTitulo("Postre gratis");

        Promocion creada = promocionService.crear(nueva, "mexicanfood@fidelyfood.local");

        assertSame(restaurante, creada.getRestaurante());
    }

    @Test
    void crearConEmailDeUnRestauranteInexistenteLanzaResourceNotFound() {
        // Cubre también el caso de que un cliente (ROLE_USER) llegue aquí:
        // su email nunca existe en RestauranteDAO, así que nunca puede crear
        // una promoción "a nombre de" un restaurante ajeno.
        when(restauranteDAO.findByEmail("cliente@test.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> promocionService.crear(new Promocion(), "cliente@test.com"));
        verifyNoInteractions(promocionDAO);
    }

    @Test
    void actualizarConRestauranteDistintoDelDuenoLanzaAccessDeniedYNoGuarda() {
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));

        Promocion cambios = new Promocion();
        cambios.setTitulo("Titulo hackeado");

        assertThrows(AccessDeniedException.class,
                () -> promocionService.actualizar(7L, cambios, "otro-restaurante@test.com"));
        verify(promocionDAO, never()).save(any());
    }

    @Test
    void actualizarConElDuenoRealGuardaLosCambios() {
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));
        when(promocionDAO.save(any(Promocion.class))).thenAnswer(inv -> inv.getArgument(0));

        Promocion cambios = new Promocion();
        cambios.setTitulo("3x2 en tacos");
        cambios.setPuntosOtorgados(80);
        cambios.setTipo("GANAR");
        cambios.setActiva(true);

        Promocion actualizada = promocionService.actualizar(7L, cambios, "mexicanfood@fidelyfood.local");

        assertEquals("3x2 en tacos", actualizada.getTitulo());
        assertEquals(80, actualizada.getPuntosOtorgados());
    }

    @Test
    void eliminarConRestauranteAjenoLanzaAccessDeniedYNoBorra() {
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));

        assertThrows(AccessDeniedException.class,
                () -> promocionService.eliminar(7L, "otro-restaurante@test.com"));
        verify(promocionDAO, never()).delete(any());
    }

    @Test
    void aplicarPromocionConRestauranteAjenoLanzaAccessDeniedYNoSumaPuntos() {
        // Regresión del mismo patrón que FID-005: si esta comprobación
        // faltara, cualquier restaurante autenticado podría regalar los
        // puntos de la promoción de OTRO restaurante a un usuario cualquiera.
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));

        assertThrows(AccessDeniedException.class,
                () -> promocionService.aplicarPromocion(7L, 42L, "otro-restaurante@test.com"));
        verifyNoInteractions(usuarioDAO, movimientoPuntosDAO);
    }

    @Test
    void aplicarPromocionConElDuenoRealSumaPuntosYRegistraMovimiento() {
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));

        Usuario usuario = new Usuario();
        usuario.setId(42L);
        usuario.setPuntos(10);
        when(usuarioDAO.findById(42L)).thenReturn(Optional.of(usuario));

        promocionService.aplicarPromocion(7L, 42L, "mexicanfood@fidelyfood.local");

        assertEquals(60, usuario.getPuntos());
        verify(usuarioDAO).save(usuario);
        verify(movimientoPuntosDAO).save(argThat(mov ->
                mov.getPuntos() == 50
                        && "GANADOS".equals(mov.getTipo())
                        && mov.getUsuario() == usuario
                        && mov.getRestaurante() == dueno));
    }

    @Test
    void aplicarPromocionConUsuarioInexistenteLanzaResourceNotFound() {
        Restaurante dueno = restaurante(1L, "mexicanfood@fidelyfood.local");
        Promocion existente = promocionDe(dueno);
        when(promocionDAO.findById(7L)).thenReturn(Optional.of(existente));
        when(usuarioDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> promocionService.aplicarPromocion(7L, 99L, "mexicanfood@fidelyfood.local"));
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void crearConImagenDemasiadoGrandeLanzaBadRequestYNoGuardaNada() {
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));

        byte[] contenido = new byte[6 * 1024 * 1024]; // > 5MB
        MultipartFile imagenGrande = new MockMultipartFile("imagen", "foto.jpg", "image/jpeg", contenido);

        assertThrows(BadRequestException.class,
                () -> promocionService.crearConImagen(new Promocion(), imagenGrande, "mexicanfood@fidelyfood.local"));
        verify(promocionDAO, never()).save(any());
    }

    @Test
    void crearConImagenDeTipoNoPermitidoLanzaBadRequest() {
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));

        MultipartFile imagenInvalida = new MockMultipartFile("imagen", "foto.gif", "image/gif", "contenido".getBytes());

        assertThrows(BadRequestException.class,
                () -> promocionService.crearConImagen(new Promocion(), imagenInvalida, "mexicanfood@fidelyfood.local"));
        verify(promocionDAO, never()).save(any());
    }

    @Test
    void crearConImagenVaciaGuardaLaPromocionSinTocarLaImagen() {
        // El formulario "Crear Promo" del frontend siempre manda multipart,
        // incluso cuando el usuario no adjunta ninguna imagen nueva.
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findByEmail("mexicanfood@fidelyfood.local")).thenReturn(Optional.of(restaurante));
        when(promocionDAO.save(any(Promocion.class))).thenAnswer(inv -> inv.getArgument(0));

        MultipartFile imagenVacia = new MockMultipartFile("imagen", new byte[0]);

        Promocion nueva = new Promocion();
        nueva.setTitulo("Sin imagen");

        Promocion creada = promocionService.crearConImagen(nueva, imagenVacia, "mexicanfood@fidelyfood.local");

        assertNull(creada.getImagenUrl());
    }

    @Test
    void validarRestauranteAutenticadoConOtroEmailLanzaAccessDenied() {
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));

        assertThrows(AccessDeniedException.class,
                () -> promocionService.validarRestauranteAutenticado(1L, "otro-restaurante@test.com"));
    }

    @Test
    void validarRestauranteAutenticadoConElDuenoRealNoLanzaNada() {
        Restaurante restaurante = restaurante(1L, "mexicanfood@fidelyfood.local");
        when(restauranteDAO.findById(1L)).thenReturn(Optional.of(restaurante));

        assertDoesNotThrow(() ->
                promocionService.validarRestauranteAutenticado(1L, "mexicanfood@fidelyfood.local"));
    }
}
