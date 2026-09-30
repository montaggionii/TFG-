package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.MovimientoPuntosDTO;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Cobertura de MovimientoPuntosService, el último servicio de negocio no
 * trivial sin ningún test unitario (junto a CompraService/RecompensaService,
 * cerrados en FID-016). `obtenerHistorialUsuario` identifica al usuario por
 * el email autenticado (MovimientoPuntosController usa
 * `authentication.getName()`, nunca un id del cliente), así que no hay
 * vulnerabilidad de autorización que probar aquí (mismo patrón correcto ya
 * verificado en FID-005/FID-013/FID-015/FID-016); esta suite cubre el
 * mapeo a DTO (incluidos los campos `monto`/`usuarioNombre`/
 * `usuarioFotoPerfil` añadidos en el PR #33) y el caso de usuario
 * inexistente.
 */
@ExtendWith(MockitoExtension.class)
class MovimientoPuntosServiceTest {

    @Mock
    private MovimientoPuntosDAO movimientoPuntosDAO;
    @Mock
    private UsuarioDAO usuarioDAO;

    private MovimientoPuntosService movimientoPuntosService;

    @BeforeEach
    void setUp() {
        movimientoPuntosService = new MovimientoPuntosService(movimientoPuntosDAO, usuarioDAO);
    }

    private Usuario usuario() {
        Usuario u = new Usuario();
        u.setId(1L);
        u.setEmail("cliente@test.com");
        u.setNombre("Diego Torres");
        u.setFotoPerfil("/uploads/perfiles/usuario_1.jpg");
        return u;
    }

    private MovimientoPuntos movimiento(Usuario usuario, int puntos, String tipo, Double monto) {
        MovimientoPuntos m = new MovimientoPuntos();
        m.setUsuario(usuario);
        m.setPuntos(puntos);
        m.setTipo(tipo);
        m.setDescripcion("Compra en Mexican Food");
        m.setFecha(LocalDateTime.of(2026, 9, 29, 12, 0));
        m.setMonto(monto);
        return m;
    }

    @Test
    void obtenerHistorialConUsuarioInexistenteLanzaResourceNotFoundYNoConsultaMovimientos() {
        when(usuarioDAO.findByEmail("fantasma@fidelyfood.local")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> movimientoPuntosService.obtenerHistorialUsuario("fantasma@fidelyfood.local"));
        verifyNoInteractions(movimientoPuntosDAO);
    }

    @Test
    void obtenerHistorialSinMovimientosDevuelveListaVacia() {
        Usuario usuario = usuario();
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(List.of());

        List<MovimientoPuntosDTO> historial =
                movimientoPuntosService.obtenerHistorialUsuario("cliente@test.com");

        assertTrue(historial.isEmpty());
    }

    @Test
    void obtenerHistorialMapeaCadaMovimientoConDatosRealesDelUsuarioAutenticado() {
        Usuario usuario = usuario();
        MovimientoPuntos ganado = movimiento(usuario, 25, "GANADOS", 25.50);
        MovimientoPuntos canjeado = movimiento(usuario, -50, "CANJEADOS", null);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(movimientoPuntosDAO.findByUsuario(usuario)).thenReturn(List.of(ganado, canjeado));

        List<MovimientoPuntosDTO> historial =
                movimientoPuntosService.obtenerHistorialUsuario("cliente@test.com");

        assertEquals(2, historial.size());

        MovimientoPuntosDTO dtoGanado = historial.get(0);
        assertEquals(25, dtoGanado.getPuntos());
        assertEquals("GANADOS", dtoGanado.getTipo());
        assertEquals(25.50, dtoGanado.getMonto());
        assertEquals("Diego Torres", dtoGanado.getUsuarioNombre());
        assertEquals("/uploads/perfiles/usuario_1.jpg", dtoGanado.getUsuarioFotoPerfil());

        MovimientoPuntosDTO dtoCanjeado = historial.get(1);
        assertEquals(-50, dtoCanjeado.getPuntos());
        assertEquals("CANJEADOS", dtoCanjeado.getTipo());
        assertNull(dtoCanjeado.getMonto());
        assertEquals("Diego Torres", dtoCanjeado.getUsuarioNombre());
    }
}
