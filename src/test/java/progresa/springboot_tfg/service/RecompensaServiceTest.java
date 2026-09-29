package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RecompensaDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Recompensa;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cobertura de RecompensaService, sin cubrir hasta ahora (solo vivía en la
 * suite E2E, que requiere backend/frontend/MySQL reales). `canjearRecompensa`
 * identifica al usuario por el email autenticado (RecompensaController usa
 * `authentication.getName()`, nunca un id del cliente), así que no hay
 * vulnerabilidad de autorización que probar aquí (a diferencia de
 * FID-005/FID-013/FID-015); esta suite se centra en la lógica de negocio del
 * canje: puntos insuficientes, resta correcta y registro del movimiento.
 */
@ExtendWith(MockitoExtension.class)
class RecompensaServiceTest {

    @Mock
    private RecompensaDAO recompensaDAO;
    @Mock
    private UsuarioDAO usuarioDAO;
    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;

    private RecompensaService recompensaService;

    @BeforeEach
    void setUp() {
        recompensaService = new RecompensaService(recompensaDAO, usuarioDAO, movimientoPuntosDAO);
    }

    private Usuario usuario(int puntos) {
        Usuario u = new Usuario();
        u.setId(1L);
        u.setPuntos(puntos);
        return u;
    }

    private Recompensa recompensa(int puntosNecesarios) {
        Recompensa r = new Recompensa();
        r.setId(5L);
        r.setNombre("Menú gratis");
        r.setPuntosNecesarios(puntosNecesarios);
        return r;
    }

    @Test
    void obtenerPorIdConIdInexistenteLanzaResourceNotFound() {
        when(recompensaDAO.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> recompensaService.obtenerPorId(99L));
    }

    @Test
    void canjearConUsuarioInexistenteLanzaResourceNotFoundYNoTocaLaRecompensa() {
        when(usuarioDAO.findByEmail("fantasma@fidelyfood.local")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> recompensaService.canjearRecompensa(5L, "fantasma@fidelyfood.local"));
        verifyNoInteractions(recompensaDAO, movimientoPuntosDAO);
    }

    @Test
    void canjearConRecompensaInexistenteLanzaResourceNotFound() {
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario(1000)));
        when(recompensaDAO.findById(5L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> recompensaService.canjearRecompensa(5L, "cliente@test.com"));
        verify(usuarioDAO, never()).save(any());
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void canjearConPuntosInsuficientesLanzaBadRequestYNoRestaNiRegistraNada() {
        Usuario usuario = usuario(10);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(recompensaDAO.findById(5L)).thenReturn(Optional.of(recompensa(50)));

        assertThrows(BadRequestException.class,
                () -> recompensaService.canjearRecompensa(5L, "cliente@test.com"));
        assertEquals(10, usuario.getPuntos());
        verify(usuarioDAO, never()).save(any());
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void canjearConPuntosSuficientesRestaPuntosYRegistraMovimientoCanjeado() {
        Usuario usuario = usuario(100);
        Recompensa recompensa = recompensa(50);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(recompensaDAO.findById(5L)).thenReturn(Optional.of(recompensa));

        recompensaService.canjearRecompensa(5L, "cliente@test.com");

        assertEquals(50, usuario.getPuntos());
        verify(usuarioDAO).save(usuario);
        verify(movimientoPuntosDAO).save(argThat(mov ->
                mov.getPuntos() == -50
                        && "CANJEADOS".equals(mov.getTipo())
                        && mov.getUsuario() == usuario
                        && mov.getDescripcion().contains("Menú gratis")));
    }

    @Test
    void canjearConPuntosExactosDejaSaldoEnCeroYPermiteElCanje() {
        Usuario usuario = usuario(50);
        Recompensa recompensa = recompensa(50);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(recompensaDAO.findById(5L)).thenReturn(Optional.of(recompensa));

        recompensaService.canjearRecompensa(5L, "cliente@test.com");

        assertEquals(0, usuario.getPuntos());
        verify(usuarioDAO).save(usuario);
        verify(movimientoPuntosDAO).save(any());
    }
}
